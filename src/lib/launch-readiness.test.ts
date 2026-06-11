import { describe, expect, it } from "vitest";

import {
  buildLaunchReadinessReport,
  summarizeLaunchReadinessReport,
  type LaunchReadinessContext
} from "@/lib/launch-readiness";
import type { EvidenceCoverageSummary } from "@/lib/evidence-coverage";
import type { OperationsReadinessReport } from "@/lib/operations-readiness";
import type { SourceCandidatePromotionReadinessSnapshot } from "@/lib/operator/curation-promotion";
import type { OperatorReadinessReport } from "@/lib/operator/readiness";
import type { ProductionReadinessReport } from "@/lib/production-readiness";

describe("launch readiness report", () => {
  it("aggregates current-style blockers without leaking evidence values", () => {
    const report = buildLaunchReadinessReport({
      env: {
        APEX_PUBLIC_SMOKE_PASSED_AT: "2026-06-11T00:00:00Z"
      },
      evidenceCoverage: {
        dataSource: "seed",
        report: coverageSummary({
          claimReviewBacklog: 7,
          humanReviewedClaims: 0,
          interventionGaps: 1
        })
      },
      files: {
        launchChecklist: true,
        postLaunchReviewTemplate: true
      },
      generatedAt: new Date("2026-06-11T00:00:00.000Z"),
      operations: readinessReport(["uptime-monitoring"]) as OperationsReadinessReport,
      operator: readinessReport(["operator-auth-config"]) as OperatorReadinessReport,
      production: readinessReport(["database-url"]) as ProductionReadinessReport,
      promotion: {
        snapshot: promotionSnapshot({ blockedCount: 1, readyCount: 0, total: 1 })
      },
      scheduledIngestion: {
        hostedCronReady: false,
        hostedRunGateReady: true,
        missingEnv: ["DATABASE_URL", "APEX_DATA_SOURCE=database"],
        noAutoPromotion: true,
        retryAutomationReady: false
      }
    });

    expect(report.overall).toBe("blocked");
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "fully-live-launch-checklist",
          status: "ready"
        }),
        expect.objectContaining({
          id: "production-readiness",
          status: "blocked",
          blockerIds: ["database-url"]
        }),
        expect.objectContaining({
          id: "scheduled-ingestion",
          status: "blocked",
          blockerIds: ["hosted-cron", "retry-policy"]
        }),
        expect.objectContaining({
          id: "evidence-coverage",
          status: "blocked",
          blockerIds: [
            "database-data-source",
            "human-reviewed-claims",
            "claim-review-backlog",
            "intervention-gaps"
          ]
        }),
        expect.objectContaining({
          id: "public-smoke",
          status: "ready"
        }),
        expect.objectContaining({
          id: "launch-approval",
          status: "blocked"
        })
      ])
    );
    expect(report.worksheet.humanOwned).toBe(true);
    expect(report.worksheet.copySafeCommands).toEqual([
      {
        command: "npm run launch:readiness",
        id: "launch-readiness",
        label: "Refresh aggregate launch readiness",
        mode: "read-only",
        purpose:
          "Recheck production, operator, operations, ingestion, promotion, coverage, smoke, and launch evidence gates."
      },
      {
        command: "npm run launch:readiness -- --summary",
        id: "launch-readiness-summary",
        label: "Refresh compact launch summary",
        mode: "read-only",
        purpose:
          "Print a compact launch status with counts, blocked gates, ready gates, and the next action."
      },
      {
        command: "npm run production:readiness",
        id: "production-readiness",
        label: "Refresh production readiness",
        mode: "read-only",
        purpose:
          "Recheck managed database, migration rehearsal, Vercel project, and secret evidence without printing secret values."
      },
      {
        command: "npm run operator:readiness",
        id: "operator-readiness",
        label: "Refresh operator readiness",
        mode: "read-only",
        purpose:
          "Recheck GitHub OAuth, active operator, manual QA, and browser-write-control evidence without enabling writes."
      },
      {
        command: "npm run operations:readiness",
        id: "operations-readiness",
        label: "Refresh operations readiness",
        mode: "read-only",
        purpose:
          "Recheck monitoring, alert, backup, restore, rollback, privacy, terms, and runbook evidence."
      },
      {
        command: "npm run ingest:scheduled-dry-run",
        id: "scheduled-ingestion-dry-run",
        label: "Refresh scheduled ingestion dry run",
        mode: "read-only",
        purpose:
          "Recheck hosted-cron, retry-policy, queue, dedupe, and no-auto-promotion readiness without running jobs."
      },
      {
        command: "npm run coverage:review",
        id: "coverage-review",
        label: "Refresh evidence coverage review",
        mode: "read-only",
        purpose:
          "Recheck human-reviewed coverage, review backlog, source-packet readiness, and intervention gaps."
      },
      {
        command: "npm run promotion:dry-run -- --pmid <pmid>",
        id: "promotion-dry-run",
        label: "Dry-run accepted candidate promotion",
        mode: "read-only",
        purpose:
          "Inspect promotion blockers for an accepted PubMed candidate before any explicit human promotion decision."
      },
      {
        command: "npm run smoke:public-mvp -- <fully-live-url>",
        id: "public-smoke",
        label: "Smoke fully-live public routes",
        mode: "read-only",
        purpose:
          "Verify the public URL, legal pages, security headers, health endpoint, and live-source preview guards."
      },
      {
        command: "npm run operator:smoke -- <fully-live-url>",
        id: "operator-anonymous-smoke",
        label: "Smoke anonymous operator boundary",
        mode: "read-only",
        purpose:
          "Verify anonymous visitors cannot see operator queues, audit content, promotion controls, or write controls."
      }
    ]);
    expect(report.worksheet.readyGates.map((gate) => gate.id)).toEqual([
      "fully-live-launch-checklist",
      "post-launch-review-template",
      "public-smoke"
    ]);
    expect(report.worksheet.blockedGates.map((gate) => gate.id)).toEqual([
      "production-readiness",
      "operator-readiness",
      "operations-readiness",
      "scheduled-ingestion",
      "promotion-readiness",
      "evidence-coverage",
      "admin-flow-smoke",
      "launch-approval",
      "post-launch-review"
    ]);
    expect(report.worksheet.nextLaunchAction).toBe(
      "database-url blocked."
    );
    expect(report.worksheet.blockedGates[0]).toEqual(
      expect.objectContaining({
        id: "production-readiness",
        nextAction: "database-url blocked."
      })
    );
    expect(JSON.stringify(report)).not.toContain("2026-06-11T00:00:00Z");
  });

  it("emits only read-only commands for launch handoff", () => {
    const report = buildLaunchReadinessReport({
      env: {},
      evidenceCoverage: {
        dataSource: "seed",
        report: coverageSummary({
          claimReviewBacklog: 7,
          humanReviewedClaims: 0,
          interventionGaps: 1
        })
      },
      files: {
        launchChecklist: true,
        postLaunchReviewTemplate: true
      },
      generatedAt: new Date("2026-06-11T00:00:00.000Z"),
      operations: readinessReport(["uptime-monitoring"]) as OperationsReadinessReport,
      operator: readinessReport(["operator-auth-config"]) as OperatorReadinessReport,
      production: readinessReport(["database-url"]) as ProductionReadinessReport,
      promotion: {
        snapshot: promotionSnapshot({ blockedCount: 1, readyCount: 0, total: 1 })
      },
      scheduledIngestion: {
        hostedCronReady: false,
        hostedRunGateReady: true,
        missingEnv: ["DATABASE_URL", "APEX_DATA_SOURCE=database"],
        noAutoPromotion: true,
        retryAutomationReady: false
      }
    });
    const blockedWriteTokens = [
      "--apply",
      "ingest:scheduled-run",
      "operator:bootstrap",
      "--accept-candidate",
      "--reject-candidate",
      "--link-candidate-claim",
      "--extract-candidate-study"
    ];

    expect(report.worksheet.copySafeCommands).toHaveLength(10);
    expect(report.worksheet.copySafeCommands.every((item) => item.mode === "read-only")).toBe(
      true
    );
    expect(
      report.worksheet.copySafeCommands.some((item) =>
        blockedWriteTokens.some((token) => item.command.includes(token))
      )
    ).toBe(false);
  });

  it("summarizes launch readiness without full nested report payloads", () => {
    const report = buildLaunchReadinessReport({
      env: {},
      evidenceCoverage: {
        dataSource: "seed",
        report: coverageSummary({
          claimReviewBacklog: 7,
          humanReviewedClaims: 0,
          interventionGaps: 1
        })
      },
      files: {
        launchChecklist: true,
        postLaunchReviewTemplate: true
      },
      generatedAt: new Date("2026-06-11T00:00:00.000Z"),
      operations: readinessReport(["uptime-monitoring"]) as OperationsReadinessReport,
      operator: readinessReport(["operator-auth-config"]) as OperatorReadinessReport,
      production: readinessReport(["database-url"]) as ProductionReadinessReport,
      promotion: {
        snapshot: promotionSnapshot({ blockedCount: 1, readyCount: 0, total: 1 })
      },
      scheduledIngestion: {
        hostedCronReady: false,
        hostedRunGateReady: true,
        missingEnv: ["DATABASE_URL", "APEX_DATA_SOURCE=database"],
        noAutoPromotion: true,
        retryAutomationReady: false
      }
    });

    expect(summarizeLaunchReadinessReport(report)).toEqual({
      blockedGates: report.worksheet.blockedGates,
      counts: {
        blocked: 10,
        ready: 2,
        warning: 0
      },
      generatedAt: "2026-06-11T00:00:00.000Z",
      humanOwned: true,
      nextAction: "database-url blocked.",
      overall: "blocked",
      readOnly: true,
      readyGates: report.worksheet.readyGates,
      warningGates: []
    });
    expect(JSON.stringify(summarizeLaunchReadinessReport(report))).not.toContain("checks");
    expect(JSON.stringify(summarizeLaunchReadinessReport(report))).not.toContain(
      "copySafeCommands"
    );
  });

  it("blocks scheduled ingestion when the hosted-run gate is not verified", () => {
    const report = buildLaunchReadinessReport({
      env: {
        APEX_ADMIN_FLOW_SMOKE_PASSED_AT: "recorded",
        APEX_FULLY_LIVE_LAUNCH_APPROVED_AT: "recorded",
        APEX_POST_LAUNCH_REVIEW_SCHEDULED_AT: "recorded",
        APEX_PUBLIC_SMOKE_PASSED_AT: "recorded"
      },
      evidenceCoverage: {
        dataSource: "database",
        report: coverageSummary({
          claimReviewBacklog: 0,
          humanReviewedClaims: 7,
          interventionGaps: 0
        })
      },
      files: {
        launchChecklist: true,
        postLaunchReviewTemplate: true
      },
      generatedAt: new Date("2026-06-11T00:00:00.000Z"),
      operations: readinessReport([]) as OperationsReadinessReport,
      operator: readinessReport([]) as OperatorReadinessReport,
      production: readinessReport([]) as ProductionReadinessReport,
      promotion: {
        snapshot: promotionSnapshot({ blockedCount: 0, readyCount: 1, total: 1 })
      },
      scheduledIngestion: {
        hostedCronReady: true,
        hostedRunGateReady: false,
        missingEnv: [],
        noAutoPromotion: true,
        retryAutomationReady: true
      }
    } satisfies LaunchReadinessContext);

    expect(report.overall).toBe("blocked");
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blockerIds: ["hosted-run-gate"],
          id: "scheduled-ingestion",
          nextAction:
            "Refresh scheduled ingestion dry-run and verify the hosted-run gate before launch.",
          status: "blocked"
        })
      ])
    );
  });

  it("reports ready only when launch evidence and nested gates are ready", () => {
    const report = buildLaunchReadinessReport({
      env: {
        APEX_ADMIN_FLOW_SMOKE_PASSED_AT: "recorded",
        APEX_FULLY_LIVE_LAUNCH_APPROVED_AT: "recorded",
        APEX_POST_LAUNCH_REVIEW_SCHEDULED_AT: "recorded",
        APEX_PUBLIC_SMOKE_PASSED_AT: "recorded"
      },
      evidenceCoverage: {
        dataSource: "database",
        report: coverageSummary({
          claimReviewBacklog: 0,
          humanReviewedClaims: 7,
          interventionGaps: 0
        })
      },
      files: {
        launchChecklist: true,
        postLaunchReviewTemplate: true
      },
      generatedAt: new Date("2026-06-11T00:00:00.000Z"),
      operations: readinessReport([]) as OperationsReadinessReport,
      operator: readinessReport([]) as OperatorReadinessReport,
      production: readinessReport([]) as ProductionReadinessReport,
      promotion: {
        snapshot: promotionSnapshot({ blockedCount: 0, readyCount: 1, total: 1 })
      },
      scheduledIngestion: {
        hostedCronReady: true,
        hostedRunGateReady: true,
        missingEnv: [],
        noAutoPromotion: true,
        retryAutomationReady: true
      }
    } satisfies LaunchReadinessContext);

    expect(report.overall).toBe("ready");
    expect(report.counts.blocked).toBe(0);
    expect(report.nextAction).toBe(
      "All launch readiness gates are ready; proceed with the launch checklist."
    );
    expect(report.worksheet.blockedGates).toEqual([]);
    expect(report.worksheet.readyGates).toHaveLength(12);
    expect(report.worksheet.nextLaunchAction).toBe(
      "All launch readiness gates are ready; proceed with the launch checklist."
    );
    expect(report.checks.map((check) => check.status)).toEqual(
      expect.arrayContaining(["ready"])
    );
  });

  it("blocks launch approval when the launch checklist artifact is missing", () => {
    const report = buildLaunchReadinessReport({
      env: {
        APEX_ADMIN_FLOW_SMOKE_PASSED_AT: "recorded",
        APEX_FULLY_LIVE_LAUNCH_APPROVED_AT: "recorded",
        APEX_POST_LAUNCH_REVIEW_SCHEDULED_AT: "recorded",
        APEX_PUBLIC_SMOKE_PASSED_AT: "recorded"
      },
      evidenceCoverage: {
        dataSource: "database",
        report: coverageSummary({
          claimReviewBacklog: 0,
          humanReviewedClaims: 7,
          interventionGaps: 0
        })
      },
      files: {
        launchChecklist: false,
        postLaunchReviewTemplate: true
      },
      generatedAt: new Date("2026-06-11T00:00:00.000Z"),
      operations: readinessReport([]) as OperationsReadinessReport,
      operator: readinessReport([]) as OperatorReadinessReport,
      production: readinessReport([]) as ProductionReadinessReport,
      promotion: {
        snapshot: promotionSnapshot({ blockedCount: 0, readyCount: 1, total: 1 })
      },
      scheduledIngestion: {
        hostedCronReady: true,
        hostedRunGateReady: true,
        missingEnv: [],
        noAutoPromotion: true,
        retryAutomationReady: true
      }
    } satisfies LaunchReadinessContext);

    expect(report.overall).toBe("blocked");
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "fully-live-launch-checklist",
          nextAction:
            "Create docs/codex/fully-live-launch-checklist.md before launch approval.",
          status: "blocked"
        })
      ])
    );
  });

  it("blocks launch approval when the post-launch review template is missing", () => {
    const report = buildLaunchReadinessReport({
      env: {
        APEX_ADMIN_FLOW_SMOKE_PASSED_AT: "recorded",
        APEX_FULLY_LIVE_LAUNCH_APPROVED_AT: "recorded",
        APEX_POST_LAUNCH_REVIEW_SCHEDULED_AT: "recorded",
        APEX_PUBLIC_SMOKE_PASSED_AT: "recorded"
      },
      evidenceCoverage: {
        dataSource: "database",
        report: coverageSummary({
          claimReviewBacklog: 0,
          humanReviewedClaims: 7,
          interventionGaps: 0
        })
      },
      files: {
        launchChecklist: true,
        postLaunchReviewTemplate: false
      },
      generatedAt: new Date("2026-06-11T00:00:00.000Z"),
      operations: readinessReport([]) as OperationsReadinessReport,
      operator: readinessReport([]) as OperatorReadinessReport,
      production: readinessReport([]) as ProductionReadinessReport,
      promotion: {
        snapshot: promotionSnapshot({ blockedCount: 0, readyCount: 1, total: 1 })
      },
      scheduledIngestion: {
        hostedCronReady: true,
        hostedRunGateReady: true,
        missingEnv: [],
        noAutoPromotion: true,
        retryAutomationReady: true
      }
    } satisfies LaunchReadinessContext);

    expect(report.overall).toBe("blocked");
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "post-launch-review-template",
          nextAction:
            "Create docs/codex/post-launch-review-template.md before launch approval.",
          status: "blocked"
        })
      ])
    );
  });
});

function readinessReport(blockedIds: string[]) {
  const checks = blockedIds.map((id) => ({
    detail: `${id} blocked.`,
    id,
    label: id,
    status: "blocked"
  }));

  if (checks.length === 0) {
    checks.push({
      detail: "ready",
      id: "ready-check",
      label: "Ready check",
      status: "ready"
    });
  }

  return {
    checks,
    counts: {
      blocked: blockedIds.length,
      info: 0,
      ready: checks.filter((check) => check.status === "ready").length,
      warning: 0
    },
    generatedAt: "2026-06-11T00:00:00.000Z",
    overall: blockedIds.length > 0 ? "blocked" : "ready",
    worksheet: {
      blocked: blockedIds.map((id) => ({
        id,
        label: id,
        nextAction: `${id} blocked.`
      })),
      copySafeCommands: [
        {
          command: "npm run production:readiness",
          id: "production-readiness",
          label: "Refresh production readiness",
          mode: "read-only",
          purpose:
            "Recheck production database, secrets, and evidence gates without printing secret values."
        }
      ],
      humanOwned: true as const,
      missingExternalEvidence: blockedIds.map((id) => ({
        id,
        label: id,
        nextAction: `${id} blocked.`
      })),
      nextOperatorAction:
        blockedIds.length > 0
          ? `${blockedIds[0]} blocked.`
          : "Production provisioning evidence is ready; review launch readiness before migration.",
      nextEvidenceAction:
        blockedIds.length > 0
          ? `${blockedIds[0]} blocked.`
          : "All external operations evidence is recorded; review the launch readiness report.",
      ready: blockedIds.length > 0 ? [] : [{ id: "ready-check", label: "Ready check" }],
      readyEvidence: blockedIds.length > 0 ? [] : [{ id: "ready-check", label: "Ready check" }],
      readyExternalEvidence: blockedIds.length > 0 ? [] : [{ id: "ready-check", label: "Ready check" }],
      readyLocalArtifacts: [],
      warnings: []
    }
  };
}

function coverageSummary({
  claimReviewBacklog,
  humanReviewedClaims,
  interventionGaps
}: {
  claimReviewBacklog: number;
  humanReviewedClaims: number;
  interventionGaps: number;
}): EvidenceCoverageSummary {
  return {
    claimReviewBacklog: Array.from({ length: claimReviewBacklog }, (_, index) => ({
      claimId: `claim-${index}`,
      confidenceLevel: "Low",
      extractedReferences: 1,
      finalLabel: "Insufficient Evidence",
      interventionId: `intervention-${index}`,
      nextAction: "Review.",
      outcome: "Mortality/lifespan",
      packetStatus: "complete",
      priority: 100,
      priorityReasons: ["Unreviewed draft claim"],
      referenceCount: 1,
      reviewStatus: "Unreviewed AI draft"
    })),
    completeSourcePackets: 7,
    humanReviewedClaims,
    incompleteClaims: [],
    interventionGaps: Array.from({ length: interventionGaps }, (_, index) => ({
      interventionId: `intervention-gap-${index}`,
      interventionName: `Intervention ${index}`,
      nextAction: "Add scoped claim."
    })),
    interventionsWithClaims: 4,
    interventionsWithoutClaims: [],
    reviewSamplingPlan: {
      batchSize: 0,
      items: [],
      nextAction: "No complete unreviewed source packets are ready for sampling.",
      readyClaims: 0
    },
    totalClaims: 7,
    totalInterventions: 5,
    unreviewedClaims: Math.max(0, 7 - humanReviewedClaims),
    worksheet: {
      coverageGaps: [],
      copySafeCommands: [],
      humanOwned: true,
      nextHumanAction: "No complete unreviewed source packets are ready for sampling.",
      readyReviewBatch: [],
      readySourcePackets: [],
      remainingBacklog: []
    }
  };
}

function promotionSnapshot({
  blockedCount,
  readyCount,
  total
}: {
  blockedCount: number;
  readyCount: number;
  total: number;
}): SourceCandidatePromotionReadinessSnapshot {
  return {
    blockedCount,
    readyCount,
    rows: Array.from({ length: total }, (_, index) => ({
      blockers: index < blockedCount ? ["Candidate must be linked to a claim."] : [],
      candidate: {
        acceptedReferenceId: "ref",
        claimId: index < blockedCount ? undefined : "claim",
        decision: "Accepted",
        dedupeKey: `candidate-${index}`,
        externalId: `external-${index}`,
        reviewStatus: "Human reviewed",
        source: "PubMed",
        title: `Candidate ${index}`
      },
      nextAction:
        index < blockedCount
          ? "Candidate must be linked to a claim."
          : "Ready for explicit human promotion review.",
      publicSourcePacketReady: index >= blockedCount,
      ready: index >= blockedCount,
      status: index < blockedCount ? "Claim link missing" : "Public source packet ready"
    })),
    total
  };
}
