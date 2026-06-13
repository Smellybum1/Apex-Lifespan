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
        APEX_PUBLIC_DATABASE_SMOKE_PASSED_AT: "2026-06-11T00:00:00Z"
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
        command: "npm run launch:readiness -- --env-file <non-production-env-file> --summary",
        id: "launch-readiness-env-file-summary",
        label: "Refresh launch summary from env file",
        mode: "read-only",
        purpose:
          "Recheck aggregate launch gates with approved non-production evidence without printing secret values."
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
        command: "npm run production:readiness -- --env-file <non-production-env-file> --summary",
        id: "production-readiness-env-file-summary",
        label: "Refresh production summary from env file",
        mode: "read-only",
        purpose:
          "Recheck production data and secret evidence from an approved env file without printing values."
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
        command: "npm run operator:readiness -- --env-file <non-production-env-file> --summary",
        id: "operator-readiness-env-file-summary",
        label: "Refresh operator summary from env file",
        mode: "read-only",
        purpose:
          "Recheck operator auth and QA evidence from an approved env file without printing values."
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
        command: "npm run operations:readiness -- --env-file <non-production-env-file> --summary",
        id: "operations-readiness-env-file-summary",
        label: "Refresh operations summary from env file",
        mode: "read-only",
        purpose:
          "Recheck operations evidence from an approved env file without printing secret values."
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
        command: "npm run coverage:review -- --env-file <non-production-env-file> --summary",
        id: "coverage-review-env-file-summary",
        label: "Refresh evidence coverage summary from env file",
        mode: "read-only",
        purpose:
          "Recheck database-backed coverage from an approved non-production env file without printing secret values."
      },
      {
        command: "npm run promotion:readiness -- --env-file <non-production-env-file> --summary",
        id: "promotion-readiness-env-file-summary",
        label: "Refresh promotion readiness from env file",
        mode: "read-only",
        purpose:
          "Recheck accepted-candidate promotion readiness from an approved non-production env file without writing public evidence."
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
        command: "npm run smoke:public-mvp -- <fully-live-url> --require-database",
        id: "public-smoke",
        label: "Smoke fully-live public routes",
        mode: "read-only",
        purpose:
          "Verify the public URL, database-backed dashboard mode, legal pages, security headers, health endpoint, and live-source preview guards."
      },
      {
        command: "npm run operator:smoke -- <fully-live-url>",
        id: "operator-anonymous-smoke",
        label: "Smoke anonymous operator boundary",
        mode: "read-only",
        purpose:
          "Verify anonymous visitors cannot see operator queues, audit content, promotion controls, or write controls."
      },
      {
        command:
          'npm run launch:evidence -- --env-file <ignored-evidence-env-file> --evidence admin-flow-smoke --url <fully-live-url>/operator --note "<manual smoke note>" --summary',
        id: "admin-flow-smoke-evidence-dry-run",
        label: "Preview admin-flow smoke evidence",
        mode: "read-only",
        purpose:
          "Preview the local ignored-env evidence entry after authenticated operator smoke has actually passed; this dry-run does not write evidence."
      },
      {
        command:
          'npm run launch:evidence -- --env-file <ignored-evidence-env-file> --evidence post-launch-review --review-window "<24-48 hour review window>" --note "<schedule note>" --summary',
        id: "post-launch-review-evidence-dry-run",
        label: "Preview post-launch review evidence",
        mode: "read-only",
        purpose:
          "Preview the local ignored-env evidence entry after the 24-48 hour post-launch review is actually scheduled; this dry-run does not write evidence."
      },
      {
        command:
          'npm run launch:evidence -- --env-file <ignored-evidence-env-file> --evidence launch-approval --approved-by <approver> --note "<approval note>" --summary',
        id: "launch-approval-evidence-dry-run",
        label: "Preview final launch approval evidence",
        mode: "read-only",
        purpose:
          "Preview the local ignored-env evidence entry after final approval is explicit and readiness has been reviewed; this dry-run does not write evidence."
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
      "--extract-candidate-study",
      "--write"
    ];

    expect(report.worksheet.copySafeCommands).toHaveLength(19);
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
        APEX_PUBLIC_DATABASE_SMOKE_PASSED_AT: "recorded"
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

  it("does not accept generic seed-demo smoke evidence for the fully-live public smoke gate", () => {
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

    expect(report.overall).toBe("blocked");
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidenceKeys: ["APEX_PUBLIC_DATABASE_SMOKE_PASSED_AT"],
          id: "public-smoke",
          nextAction:
            "Run npm run smoke:public-mvp -- <fully-live-url> --require-database and record APEX_PUBLIC_DATABASE_SMOKE_PASSED_AT.",
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
        APEX_PUBLIC_DATABASE_SMOKE_PASSED_AT: "recorded"
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
        APEX_PUBLIC_DATABASE_SMOKE_PASSED_AT: "recorded"
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
        APEX_PUBLIC_DATABASE_SMOKE_PASSED_AT: "recorded"
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
      actionPreview: {
        browserAction:
          index < blockedCount
            ? "Resolve promotion blockers before the browser promotion action is usable."
            : `Promote accepted candidate external-${index} with an explicit human promotion note.`,
        dryRunCommand: `npm run promotion:dry-run -- candidate-${index}`,
        promotionEffect:
          index < blockedCount
            ? "No public packet write preview until accepted reference, claim link, structured extraction, and packet readiness are complete."
            : `Would expose reference ref and 1 structured extraction(s) on claim claim.`,
        requiredPermission: "evidence:promote"
      },
      extractionPrefill: {
        curationDraftCommand:
          `npm run ingest:sources -- --candidate-curation-draft candidate-${index}`,
        fieldSuggestions: [
          {
            confidence: "candidate-metadata",
            confidenceLabel: "Strong",
            confidenceRationale:
              "Value comes directly from captured source metadata or source-text preview, but still needs operator verification.",
            field: "abstract",
            label: "Abstract/source summary",
            note:
              "Captured abstract or registry summary can seed the optional study abstract field, but operators must verify source context before writing.",
            reviewConfidence: "strong",
            value: "PubMed abstract: Candidate abstract summary.",
            writeFlag: "--study-abstract"
          }
        ],
        fullTextStatus:
          "Full text is not automatically captured; operators must verify the source packet before writing extraction fields.",
        sourceTextStatus:
          index < blockedCount
            ? "No abstract or registry summary captured in candidate metadata."
            : "PubMed abstract text captured for the curation draft."
      },
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
