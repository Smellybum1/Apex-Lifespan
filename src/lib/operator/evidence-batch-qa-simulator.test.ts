import { describe, expect, it } from "vitest";

import {
  buildEvidenceBatchQaSimulation,
  type EvidenceBatchQaSimulationInput
} from "@/lib/operator/evidence-batch-qa-simulator";

const BLOCKER_CATEGORIES = [
  "missing-source-packet",
  "extraction-gap",
  "source-rights",
  "claim-review-status",
  "product-level-artg-aust-evidence",
  "public-promotion-readiness"
] as const;

const DIFF_KINDS = [
  "claim",
  "reference",
  "extraction",
  "score",
  "changelog-public-evidence"
] as const;

const APPROVAL_SECTIONS = [
  "## Diff Preview",
  "## Blocker Matrix",
  "## Rollback",
  "## Verification",
  "## Required Approvals"
] as const;

const blockedBatchInput: EvidenceBatchQaSimulationInput = {
  draftRows: [
    {
      draftId: "draft-blocked-1",
      claimId: "claim-1",
      candidateTitle: "Blocked creatine trial",
      candidateSource: "PubMed",
      targetRows: [
        { table: "ClaimReference", id: "cr-1" },
        { table: "Reference", id: "ref-1" },
        { table: "Study", id: "study-1" },
        { table: "PublicEvidence", id: "pe-1" }
      ],
      sourcePacketReadiness: {
        status: "incomplete-draft",
        blockedSectionIds: ["reference", "claim-link", "study-extraction"],
        clearBlockerList: [],
        nextHumanAction: "Complete source packet sections.",
        writes: "none"
      },
      blockers: ["Population and adverse-event extraction remain incomplete."]
    }
  ],
  transactionBoundaryRows: [
    {
      id: "changelog-public-evidence",
      label: "Public changelog publication",
      presentInBatch: true,
      requiredWriteApproval: "public-changelog-publication",
      targetTables: ["PublicChangelogEntry"],
      writes: "none"
    },
    {
      id: "claim-review-boundary",
      label: "Claim review status write",
      presentInBatch: true,
      requiredWriteApproval: "claim-review-status",
      targetTables: ["ReviewEvent"],
      writes: "none"
    }
  ],
  sourceRightsStatus: "blocked",
  sourceRightsBlockers: ["Publisher terms require manual rights confirmation."]
};

const completeProposedBatchInput: EvidenceBatchQaSimulationInput = {
  draftRows: [
    {
      draftId: "draft-ready-1",
      claimId: "claim-ready-1",
      candidateTitle: "Complete proposed creatine trial",
      candidateSource: "PubMed",
      targetRows: [
        { table: "ClaimReference", id: "cr-ready-1" },
        { table: "Reference", id: "ref-ready-1" },
        { table: "Study", id: "study-ready-1" },
        { table: "ScoreSnapshot", id: "score-ready-1" }
      ],
      sourcePacketReadiness: {
        status: "complete-proposed-packet",
        blockedSectionIds: [],
        clearBlockerList: ["reference", "claim-link", "study-extraction"],
        nextHumanAction: "Review proposed batch before any write approval.",
        writes: "none"
      }
    }
  ],
  transactionBoundaryRows: [
    {
      id: "score-review-boundary",
      label: "Score review write boundary",
      presentInBatch: true,
      requiredWriteApproval: "score-review-status",
      targetTables: ["ScoreSnapshot"],
      writes: "none"
    }
  ],
  sourceRightsStatus: "ready"
};

const fiveRowBatchInput: EvidenceBatchQaSimulationInput = {
  draftRows: Array.from({ length: 5 }, (_, index) => ({
    draftId: `draft-ready-${index + 1}`,
    claimId: `claim-ready-${index + 1}`,
    candidateTitle: `Complete proposed review packet ${index + 1}`,
    candidateSource: "PubMed",
    targetRows: [
      { table: "ClaimReference", id: `cr-batch-${index + 1}` },
      { table: "Reference", id: `ref-batch-${index + 1}` },
      { table: "Study", id: `study-batch-${index + 1}` },
      { table: "ScoreSnapshot", id: `score-batch-${index + 1}` }
    ],
    sourcePacketReadiness: {
      status: "complete-proposed-packet",
      blockedSectionIds: [],
      clearBlockerList: ["reference", "claim-link", "study-extraction"],
      nextHumanAction: "Review proposed batch before any write approval.",
      writes: "none"
    }
  })),
  transactionBoundaryRows: [
    {
      id: "changelog-public-evidence",
      label: "Public changelog publication",
      presentInBatch: true,
      requiredWriteApproval: "public-changelog-publication",
      targetTables: ["PublicChangelogEntry", "PublicEvidence"],
      writes: "none"
    }
  ],
  sourceRightsStatus: "ready"
};

function expectReadOnlyEnvelope(result: ReturnType<typeof buildEvidenceBatchQaSimulation>) {
  expect(result.readOnly).toBe(true);
  expect(result.dryRun).toBe(true);
  expect(result.noDatabaseWrite).toBe(true);
  expect(result.noPublicEvidenceRowsWritten).toBe(true);
  expect(result.writes).toBe("none");
}

function expectFrozenDiffKinds(result: ReturnType<typeof buildEvidenceBatchQaSimulation>) {
  expect(result.diffPreviews.map((preview) => preview.kind)).toEqual([...DIFF_KINDS]);
}

function expectFrozenBlockerCategories(
  result: ReturnType<typeof buildEvidenceBatchQaSimulation>
) {
  expect(result.blockerMatrix.rows.map((row) => row.category)).toEqual([
    ...BLOCKER_CATEGORIES
  ]);
  expect(result.summary.blockerCategoryCount).toBe(BLOCKER_CATEGORIES.length);
}

function expectCopySafeApprovalPacket(packet: string) {
  for (const section of APPROVAL_SECTIONS) {
    expect(packet).toContain(section);
  }

  expect(packet).not.toMatch(/\/(?:mnt|home|Users)\//i);
  expect(packet).not.toMatch(/\.env/i);
  expect(packet).not.toMatch(/APEX_[A-Z0-9_]+/);
}

describe("buildEvidenceBatchQaSimulation", () => {
  it("projects a blocked batch with source-packet, extraction, source-rights, product-level, and public-promotion blockers", () => {
    const result = buildEvidenceBatchQaSimulation(blockedBatchInput);

    expectReadOnlyEnvelope(result);
    expectFrozenDiffKinds(result);
    expectFrozenBlockerCategories(result);
    expect(result.approvalRequired).toBe(true);
    expect(result.summary).toMatchObject({
      draftCount: 1,
      readyDraftCount: 0,
      blockedDraftCount: 1,
      targetRowCount: 4,
      diffPreviewRowCount: 5
    });

    const byCategory = Object.fromEntries(
      result.blockerMatrix.rows.map((row) => [row.category, row])
    );

    expect(byCategory["missing-source-packet"]).toMatchObject({
      status: "blocked"
    });
    expect(byCategory["missing-source-packet"]?.blockers.length).toBeGreaterThan(0);

    expect(byCategory["extraction-gap"]).toMatchObject({
      status: "blocked"
    });
    expect(byCategory["extraction-gap"]?.blockers.join(" ")).toMatch(/study-extraction/i);
    expect(byCategory["extraction-gap"]?.blockers.join(" ")).toMatch(/adverse/i);

    expect(byCategory["source-rights"]).toMatchObject({
      status: "blocked",
      blockers: ["Publisher terms require manual rights confirmation."]
    });

    expect(byCategory["product-level-artg-aust-evidence"]).toMatchObject({
      status: "review-required",
      blockers: [
        "Do not infer product-level ARTG/AUST status from generic evidence; product-level evidence remains required before product status claims."
      ]
    });

    expect(byCategory["public-promotion-readiness"]).toMatchObject({
      status: "review-required"
    });
    expect(byCategory["public-promotion-readiness"]?.approvalNotes).toEqual([
      "Public evidence promotion requires explicit operator approval.",
      "Public changelog publication requires explicit operator approval."
    ]);

    const changelogPreview = result.diffPreviews.find(
      (preview) => preview.kind === "changelog-public-evidence"
    );
    expect(changelogPreview?.proposedRowCount).toBe(2);

    expectCopySafeApprovalPacket(result.approvalPacket);
  });

  it("keeps a complete-proposed batch read-only with approval required and a conservative product-level row", () => {
    const result = buildEvidenceBatchQaSimulation(completeProposedBatchInput);

    expectReadOnlyEnvelope(result);
    expectFrozenDiffKinds(result);
    expectFrozenBlockerCategories(result);
    expect(result.approvalRequired).toBe(true);
    expect(result.summary).toMatchObject({
      draftCount: 1,
      readyDraftCount: 1,
      blockedDraftCount: 0,
      targetRowCount: 4,
      diffPreviewRowCount: 4
    });

    const byCategory = Object.fromEntries(
      result.blockerMatrix.rows.map((row) => [row.category, row])
    );

    expect(byCategory["missing-source-packet"]).toMatchObject({ status: "ready" });
    expect(byCategory["extraction-gap"]).toMatchObject({ status: "ready" });
    expect(byCategory["source-rights"]).toMatchObject({ status: "ready" });
    expect(byCategory["claim-review-status"]).toMatchObject({ status: "review-required" });
    expect(byCategory["product-level-artg-aust-evidence"]).toMatchObject({
      status: "review-required",
      blockers: [
        "Do not infer product-level ARTG/AUST status from generic evidence; product-level evidence remains required before product status claims."
      ]
    });
    expect(byCategory["public-promotion-readiness"]).toMatchObject({
      status: "review-required"
    });

    expectCopySafeApprovalPacket(result.approvalPacket);
  });

  it("summarizes a five-row review packet batch without writes or public-truth promotion", () => {
    const result = buildEvidenceBatchQaSimulation(fiveRowBatchInput);

    expectReadOnlyEnvelope(result);
    expectFrozenDiffKinds(result);
    expectFrozenBlockerCategories(result);
    expect(result.summary).toMatchObject({
      draftCount: 5,
      readyDraftCount: 5,
      blockedDraftCount: 0,
      targetRowCount: 20,
      diffPreviewRowCount: 22
    });
    expect(result.approvalRequired).toBe(true);
    expect(result.diffPreviews).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "claim", proposedRowCount: 5 }),
        expect.objectContaining({ kind: "reference", proposedRowCount: 5 }),
        expect.objectContaining({ kind: "extraction", proposedRowCount: 5 }),
        expect.objectContaining({ kind: "score", proposedRowCount: 5 }),
        expect.objectContaining({
          kind: "changelog-public-evidence",
          proposedRowCount: 2
        })
      ])
    );
    expect(result.approvalPacket).toContain(
      "No database writes or public evidence publication."
    );
    expect(result.approvalPacket).toContain(
      "Public evidence promotion requires explicit operator approval."
    );
  });
});
