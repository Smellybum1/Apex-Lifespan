import { describe, expect, it } from "vitest";

import {
  buildEvidenceGapLeadPlan,
  type EvidenceGapLeadPlanSourceDiscoveryPlan
} from "@/lib/operator/evidence-gap-lead-plan";
import type { ScheduledIngestionDryRunSummary } from "@/lib/data/scheduled-ingestion";

describe("evidence gap-to-lead plan", () => {
  it("builds a read-only dry-run plan and blocks queueing without gate evidence", () => {
    const plan = buildEvidenceGapLeadPlan({
      sourceDiscoveryPlan: sourceDiscoveryPlanFixture()
    });

    expect(plan).toMatchObject({
      dryRun: true,
      humanOwned: true,
      noAutomaticCandidateDecision: true,
      noAutomaticExtractionWrite: true,
      noAutomaticIngestionRun: true,
      noAutomaticPromotion: true,
      noAutomaticQueueWrite: true,
      noPublicEvidenceRowsWritten: true,
      readOnly: true,
      scheduler: {
        gateEvidence: "not-loaded",
        hostedCronReady: false,
        hostedRunGateReady: false,
        noAutoPromotion: true,
        retryAutomationReady: false
      },
      selectionSummary:
        "selected 1 highest-priority gap(s): magnesium-sleep priority 10; writes none",
      summary: {
        blockedGates: 2,
        clinicalTrialsJobs: 1,
        proposedClaims: 1,
        proposedJobs: 2,
        pubMedJobs: 1,
        warningGates: 0
      }
    });
    expect(plan.nextAction).toBe(
      "Ask an operator to approve a bounded source-lead collection run before any candidate-writing queue action."
    );
    expect(plan.collectionHandoffPacket).toMatchObject({
      claimCount: 1,
      commandCount: 3,
      copySafe: true,
      dryRun: true,
      gateSummary: "2 blocked; 0 warning; 2 ready; writes none",
      noAutomaticCandidateDecision: true,
      noAutomaticExtractionWrite: true,
      noDatabaseWrite: true,
      noPublicEvidenceRowsWritten: true,
      noQueueWrite: true,
      queueCommands: [
        'npm run ingest:sources -- --queue-claim-sources "magnesium-sleep" --region "AU"'
      ],
      schedulerEvidence: "not-loaded",
      selectionSummary:
        "selected 1 highest-priority gap(s): magnesium-sleep priority 10; writes none",
      title: "Gap-to-Lead Collection Dry-Run Handoff",
      writes: "none"
    });
    expect(plan.collectionHandoffPacket.text).toContain(
      "# Gap-to-Lead Collection Dry-Run Handoff"
    );
    expect(plan.collectionHandoffPacket.text).toContain("- Queue write: no");
    expect(plan.collectionHandoffPacket.text).toContain(
      "- Selection: selected 1 highest-priority gap(s): magnesium-sleep priority 10; writes none"
    );
    expect(plan.collectionHandoffPacket.text).toContain(
      "Queue commands may create source-candidate leads only after explicit operator approval."
    );
    expect(plan.gates.map((gate) => [gate.id, gate.status])).toEqual([
      ["claim-gaps", "ready"],
      ["explicit-queue-approval", "blocked"],
      ["no-auto-truth", "ready"],
      ["scheduled-ingestion-evidence", "blocked"]
    ]);
    expect(plan.rows[0]).toMatchObject({
      claimId: "magnesium-sleep",
      proposedJobs: [
        {
          claimId: "magnesium-sleep",
          mode: "explicit-write-after-approval",
          query: "Magnesium sleep systematic review",
          source: "PubMed"
        },
        {
          claimId: "magnesium-sleep",
          mode: "explicit-write-after-approval",
          query: "Magnesium sleep",
          source: "ClinicalTrials.gov"
        }
      ],
      queueCommand:
        'npm run ingest:sources -- --queue-claim-sources "magnesium-sleep" --region "AU"'
    });
    expect(plan.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: "npm run ingest:scheduled-dry-run -- --summary",
          mode: "dry-run"
        }),
        expect.objectContaining({
          command:
            'npm run ingest:sources -- --queue-claim-sources "magnesium-sleep" --region "AU"',
          mode: "explicit-write-after-approval"
        })
      ])
    );
  });

  it("selects highest-priority gaps before truncating the bounded batch", () => {
    const plan = buildEvidenceGapLeadPlan({
      maxClaims: 1,
      sourceDiscoveryPlan: {
        rows: [
          {
            ...sourceDiscoveryPlanFixture().rows[0],
            claimId: "lower-priority",
            operatorQueueCommand:
              'npm run ingest:sources -- --queue-claim-sources "lower-priority" --region "AU"',
            priority: 1
          },
          {
            ...sourceDiscoveryPlanFixture().rows[0],
            claimId: "higher-priority",
            operatorQueueCommand:
              'npm run ingest:sources -- --queue-claim-sources "higher-priority" --region "AU"',
            priority: 99
          }
        ]
      }
    });

    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0]?.claimId).toBe("higher-priority");
    expect(plan.collectionHandoffPacket.queueCommands).toEqual([
      'npm run ingest:sources -- --queue-claim-sources "higher-priority" --region "AU"'
    ]);
    expect(plan.selectionSummary).toBe(
      "selected 1 highest-priority gap(s): higher-priority priority 99; writes none"
    );
  });

  it("uses scheduled-ingestion summary evidence while keeping queue approval blocked", () => {
    const plan = buildEvidenceGapLeadPlan({
      scheduledIngestion: scheduledSummaryFixture(),
      sourceDiscoveryPlan: sourceDiscoveryPlanFixture()
    });

    expect(plan.scheduler).toEqual({
      gateEvidence: "scheduled-ingestion-summary",
      hostedCronReady: true,
      hostedRunGateReady: true,
      noAutoPromotion: true,
      queuedJobs: 0,
      retryAutomationReady: true,
      wouldRunJobs: 0
    });
    expect(plan.gates.map((gate) => [gate.id, gate.status])).toEqual([
      ["claim-gaps", "ready"],
      ["explicit-queue-approval", "blocked"],
      ["no-auto-truth", "ready"],
      ["hosted-cron", "ready"],
      ["hosted-run-gate", "ready"],
      ["retry-policy", "ready"],
      ["duplicate-source-review", "ready"]
    ]);
    expect(plan.summary.blockedGates).toBe(1);
    expect(plan.collectionHandoffPacket).toMatchObject({
      gateSummary: "1 blocked; 0 warning; 6 ready; writes none",
      schedulerEvidence: "scheduled-ingestion-summary",
      writes: "none"
    });
    expect(plan.nextAction).toBe(
      "Ask an operator to approve a bounded source-lead collection run before any candidate-writing queue action."
    );
  });

  it("reports duplicate source identities as warnings before unattended loops", () => {
    const plan = buildEvidenceGapLeadPlan({
      scheduledIngestion: {
        ...scheduledSummaryFixture(),
        counts: {
          ...scheduledSummaryFixture().counts,
          duplicateIdentityGroups: 2
        }
      },
      sourceDiscoveryPlan: sourceDiscoveryPlanFixture()
    });

    expect(plan.summary.warningGates).toBe(1);
    expect(plan.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "duplicate-source-review",
          nextAction:
            "Review duplicate source identities before unattended scheduled ingestion.",
          status: "warning"
        })
      ])
    );
  });
});

function sourceDiscoveryPlanFixture(): EvidenceGapLeadPlanSourceDiscoveryPlan {
  return {
    rows: [
      {
        claimId: "magnesium-sleep",
        interventionId: "magnesium",
        interventionName: "Magnesium",
        lookupLinks: [
          {
            query: "Magnesium sleep systematic review",
            readOnly: true,
            source: "PubMed"
          },
          {
            query: "Magnesium sleep",
            readOnly: true,
            source: "ClinicalTrials.gov"
          }
        ],
        operatorQueueCommand:
          'npm run ingest:sources -- --queue-claim-sources "magnesium-sleep" --region "AU"',
        outcome: "Sleep",
        priority: 10,
        region: "AU"
      }
    ]
  };
}

function scheduledSummaryFixture(): ScheduledIngestionDryRunSummary {
  return {
    blockedChecks: [],
    counts: {
      duplicateIdentityGroups: 0,
      queuedJobs: 0,
      recentFailures: 0,
      runningJobs: 0,
      wouldRunJobs: 0
    },
    hostedCronReady: true,
    hostedRunGateReady: true,
    humanOwned: true,
    nextAction: "Scheduled ingestion gates are ready.",
    noAutoPromotion: true,
    readOnly: true,
    readyChecks: [],
    retryAutomationReady: true,
    warningChecks: []
  };
}
