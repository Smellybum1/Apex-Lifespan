import { describe, expect, it } from "vitest";

import {
  buildLaunchReadinessReport,
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
        launchChecklist: true
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
    expect(JSON.stringify(report)).not.toContain("2026-06-11T00:00:00Z");
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
        launchChecklist: true
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
        launchChecklist: false
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
