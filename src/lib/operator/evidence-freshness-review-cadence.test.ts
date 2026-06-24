import { describe, expect, it } from "vitest";

import {
  buildEvidenceFreshnessReviewCadenceMonitor,
  type EvidenceFreshnessReviewCadenceInput
} from "@/lib/operator/evidence-freshness-review-cadence";

const CATEGORIES = [
  "source-gap",
  "candidate-review",
  "review-packet",
  "extraction-gap",
  "publication-blocker"
] as const;

const CADENCE_STATUSES = ["stale", "due", "watch", "ready"] as const;

const APPROVAL_SECTIONS = [
  "# Evidence Freshness And Review Cadence Monitor",
  "## Next Review Schedule",
  "## Boundary Notes",
  "## Rollback",
  "## Verification",
  "## Required Approvals"
] as const;

const BOUNDARY_PHRASES = [
  "cadence",
  "freshness",
  "evidence quality",
  "medical",
  "regulatory",
  "source-rights",
  "public-promotion"
] as const;

const mixedTwelveRowInput: EvidenceFreshnessReviewCadenceInput = {
  sourceGaps: [
    {
      id: "sg-stale",
      label: "Stale source gap",
      claimId: "claim-sg-1",
      interventionId: "int-sg-1",
      interventionName: "Vitamin D",
      ageDays: 420,
      staleAfterDays: 365,
      priority: 90,
      nextChecks: ["Refresh source inventory"]
    },
    {
      id: "sg-due",
      label: "Due source gap",
      claimId: "claim-sg-2",
      interventionId: "int-sg-2",
      interventionName: "Magnesium",
      ageDays: 120,
      staleAfterDays: 365,
      priority: 80,
      blockers: ["Missing PubMed linkage"]
    },
    {
      id: "sg-ready-cut",
      label: "Ready source gap",
      claimId: "claim-sg-3",
      interventionId: "int-sg-3",
      interventionName: "Zinc",
      ageDays: 30,
      staleAfterDays: 365,
      priority: 10
    }
  ],
  candidateRows: [
    {
      id: "cr-stale",
      label: "Stale candidate review",
      claimId: "claim-cr-1",
      interventionId: "int-cr-1",
      interventionName: "Creatine",
      ageDays: 500,
      staleAfterDays: 180,
      priority: 85
    },
    {
      id: "cr-watch",
      label: "Watch candidate review",
      claimId: "claim-cr-2",
      interventionId: "int-cr-2",
      interventionName: "Omega-3",
      ageDays: 60,
      staleAfterDays: 365,
      priority: 70,
      nextChecks: ["Confirm candidate queue age"]
    },
    {
      id: "cr-ready-cut",
      label: "Ready candidate review",
      claimId: "claim-cr-3",
      interventionId: "int-cr-3",
      interventionName: "Iron",
      ageDays: 15,
      staleAfterDays: 365,
      priority: 5
    }
  ],
  reviewPacketRows: [
    {
      id: "rp-due",
      label: "Due review packet",
      claimId: "claim-rp-1",
      interventionId: "int-rp-1",
      interventionName: "B12",
      ageDays: 200,
      staleAfterDays: 365,
      priority: 75,
      blockers: ["Packet sections incomplete"]
    },
    {
      id: "rp-ready-cut",
      label: "Ready review packet",
      claimId: "claim-rp-2",
      interventionId: "int-rp-2",
      interventionName: "Folate",
      ageDays: 20,
      staleAfterDays: 365,
      priority: 8
    }
  ],
  extractionGapRows: [
    {
      id: "eg-stale",
      label: "Stale extraction gap",
      claimId: "claim-eg-1",
      interventionId: "int-eg-1",
      interventionName: "Collagen",
      ageDays: 400,
      staleAfterDays: 365,
      priority: 88
    },
    {
      id: "eg-watch",
      label: "Watch extraction gap",
      claimId: "claim-eg-2",
      interventionId: "int-eg-2",
      interventionName: "Probiotics",
      priority: 65,
      nextChecks: ["Confirm extraction age baseline"]
    }
  ],
  publicationBlockerRows: [
    {
      id: "pb-due",
      label: "Due publication blocker",
      claimId: "claim-pb-1",
      interventionId: "int-pb-1",
      interventionName: "Ashwagandha",
      ageDays: 150,
      staleAfterDays: 365,
      priority: 82,
      blockers: ["Public promotion hold"]
    },
    {
      id: "pb-ready-cut",
      label: "Ready publication blocker",
      claimId: "claim-pb-2",
      interventionId: "int-pb-2",
      interventionName: "Turmeric",
      ageDays: 25,
      staleAfterDays: 365,
      priority: 6
    }
  ]
};

function expectReadOnlyEnvelope(
  result: ReturnType<typeof buildEvidenceFreshnessReviewCadenceMonitor>
) {
  expect(result.readOnly).toBe(true);
  expect(result.dryRun).toBe(true);
  expect(result.noDatabaseWrite).toBe(true);
  expect(result.noSourceQueueWrite).toBe(true);
  expect(result.noCandidateDecision).toBe(true);
  expect(result.noExtractionWrite).toBe(true);
  expect(result.noClaimReviewWrite).toBe(true);
  expect(result.noPublicEvidenceWrite).toBe(true);
  expect(result.noPublicPromotion).toBe(true);
  expect(result.writes).toBe("none");
}

function expectCopySafeApprovalPacket(packet: string) {
  for (const section of APPROVAL_SECTIONS) {
    expect(packet).toContain(section);
  }

  expect(packet).not.toMatch(/\/(?:mnt|home|Users)\//i);
  expect(packet).not.toMatch(/\.env/i);
  expect(packet).not.toMatch(/APEX_[A-Z0-9_]+/);
  expect(packet).not.toMatch(/Human reviewed/i);
  expect(packet).not.toMatch(/npm run/i);
  expect(packet).not.toMatch(/--apply\b/i);
  expect(packet).not.toMatch(/db:push|db:seed/i);
}

function expectBoundaryWording(text: string) {
  for (const phrase of BOUNDARY_PHRASES) {
    expect(text.toLowerCase()).toContain(phrase);
  }
}

function allInputIds(input: EvidenceFreshnessReviewCadenceInput): string[] {
  return [
    ...(input.sourceGaps ?? []),
    ...(input.candidateRows ?? []),
    ...(input.reviewPacketRows ?? []),
    ...(input.extractionGapRows ?? []),
    ...(input.publicationBlockerRows ?? [])
  ].map((row) => row.id);
}

describe("buildEvidenceFreshnessReviewCadenceMonitor", () => {
  it("returns a clamped 10-row schedule with all five categories from mixed 12-row input", () => {
    const result = buildEvidenceFreshnessReviewCadenceMonitor(mixedTwelveRowInput);

    expectReadOnlyEnvelope(result);
    expect(result.summary.totalInputRows).toBe(12);
    expect(result.summary.scheduledRowCount).toBe(10);
    expect(result.summary.maxScheduleRows).toBe(10);
    expect(result.nextReviewSchedule).toHaveLength(10);

    for (const category of CATEGORIES) {
      expect(result.nextReviewSchedule.some((row) => row.category === category)).toBe(true);
      expect(result.summary.byCategory[category]).toBeGreaterThan(0);
    }

    const scheduledIds = new Set(result.nextReviewSchedule.map((row) => row.id));
    const droppedIds = allInputIds(mixedTwelveRowInput).filter((id) => !scheduledIds.has(id));
    expect(droppedIds).toHaveLength(2);
    expect(droppedIds).toEqual(["cr-ready-cut", "pb-ready-cut"]);

    for (const row of result.nextReviewSchedule) {
      expect(row.writes).toBe("none");
      expect(row.boundaryNotes).toContain("cadence and freshness only");
      expect(row.rollbackNotes.length).toBeGreaterThan(0);
      expect(row.verificationNotes.length).toBeGreaterThan(0);
    }

    expectCopySafeApprovalPacket(result.approvalPacket);
    expectBoundaryWording(result.approvalPacket);
    expect(result.approvalPacket.toLowerCase()).toContain("public writes are not performed");
  });

  it("returns an empty schedule with a safe no-write approval packet for empty input", () => {
    const result = buildEvidenceFreshnessReviewCadenceMonitor({});

    expectReadOnlyEnvelope(result);
    expect(result.nextReviewSchedule).toEqual([]);
    expect(result.summary.scheduledRowCount).toBe(0);
    expect(result.summary.totalInputRows).toBe(0);
    expect(result.nextAction).toMatch(/no evidence freshness review rows supplied/i);
    expect(result.nextAction).toMatch(/no writes/i);

    expectCopySafeApprovalPacket(result.approvalPacket);
    expect(result.approvalPacket).toContain("- No rows scheduled.");
    expect(result.approvalPacket).toContain(
      "- No operator approvals are implied by an empty cadence schedule."
    );
    expectBoundaryWording(result.approvalPacket);
  });

  it("orders schedule rows by cadence status, priority, age, category, and id", () => {
    const result = buildEvidenceFreshnessReviewCadenceMonitor({
      maxScheduleRows: 10,
      sourceGaps: [
        {
          id: "z-ready-low",
          label: "Ready low priority",
          ageDays: 10,
          staleAfterDays: 365,
          priority: 1
        },
        {
          id: "a-stale-high",
          label: "Stale high priority",
          ageDays: 400,
          staleAfterDays: 365,
          priority: 99
        }
      ],
      candidateRows: [
        {
          id: "b-due-mid",
          label: "Due mid priority",
          ageDays: 50,
          staleAfterDays: 365,
          priority: 50,
          blockers: ["Candidate queue hold"]
        },
        {
          id: "c-watch-unknown-age",
          label: "Watch unknown age",
          priority: 40,
          nextChecks: ["Establish review baseline"]
        }
      ],
      reviewPacketRows: [
        {
          id: "d-stale-same-priority",
          label: "Stale same priority older",
          ageDays: 500,
          staleAfterDays: 365,
          priority: 99
        },
        {
          id: "e-stale-same-priority",
          label: "Stale same priority newer",
          ageDays: 450,
          staleAfterDays: 365,
          priority: 99
        }
      ]
    });

    const statuses = result.nextReviewSchedule.map((row) => row.cadenceStatus);
    const statusIndexes = statuses.map((status) => CADENCE_STATUSES.indexOf(status));
    for (let index = 1; index < statusIndexes.length; index += 1) {
      expect(statusIndexes[index]).toBeGreaterThanOrEqual(statusIndexes[index - 1]!);
    }

    expect(result.nextReviewSchedule[0]?.id).toBe("d-stale-same-priority");
    expect(result.nextReviewSchedule[1]?.id).toBe("e-stale-same-priority");
    expect(result.nextReviewSchedule[2]?.id).toBe("a-stale-high");
    expect(result.nextReviewSchedule[3]?.cadenceStatus).toBe("due");
    expect(result.nextReviewSchedule[4]?.cadenceStatus).toBe("watch");
    expect(result.nextReviewSchedule.at(-1)?.cadenceStatus).toBe("ready");

    for (const row of result.nextReviewSchedule) {
      expectBoundaryWording(row.boundaryNotes);
    }
  });

  it("clamps maxScheduleRows between 5 and 10", () => {
    const lowCap = buildEvidenceFreshnessReviewCadenceMonitor({
      ...mixedTwelveRowInput,
      maxScheduleRows: 2
    });
    expect(lowCap.summary.maxScheduleRows).toBe(5);
    expect(lowCap.nextReviewSchedule).toHaveLength(5);

    const highCap = buildEvidenceFreshnessReviewCadenceMonitor({
      ...mixedTwelveRowInput,
      maxScheduleRows: 99
    });
    expect(highCap.summary.maxScheduleRows).toBe(10);
    expect(highCap.nextReviewSchedule).toHaveLength(10);
  });
});
