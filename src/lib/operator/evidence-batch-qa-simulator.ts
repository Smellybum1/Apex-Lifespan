export interface EvidenceBatchQaTargetRow {
  table: string;
  field?: string;
  id?: string;
}

export interface EvidenceBatchQaSourcePacketReadiness {
  status: string;
  blockedSectionIds: string[];
  clearBlockerList: string[];
  nextHumanAction: string;
  writes: "none";
}

export interface EvidenceBatchQaDraftRow {
  draftId: string;
  claimId?: string;
  candidateTitle?: string;
  candidateSource?: string;
  targetRows: EvidenceBatchQaTargetRow[];
  sourcePacketReadiness: EvidenceBatchQaSourcePacketReadiness;
  blockers?: string[];
}

export interface EvidenceBatchQaTransactionBoundaryRow {
  id: string;
  label: string;
  presentInBatch: boolean;
  requiredWriteApproval: string;
  targetTables: string[];
  writes: "none";
}

export interface EvidenceBatchQaSimulationInput {
  draftRows: EvidenceBatchQaDraftRow[];
  transactionBoundaryRows?: EvidenceBatchQaTransactionBoundaryRow[];
  sourceRightsStatus?: "ready" | "blocked" | "not-reviewed";
  sourceRightsBlockers?: string[];
}

export type EvidenceBatchQaDiffKind =
  | "claim"
  | "reference"
  | "extraction"
  | "score"
  | "changelog-public-evidence";

export type EvidenceBatchQaBlockerCategory =
  | "missing-source-packet"
  | "extraction-gap"
  | "source-rights"
  | "claim-review-status"
  | "product-level-artg-aust-evidence"
  | "public-promotion-readiness";

export type EvidenceBatchQaBlockerStatus = "ready" | "blocked" | "review-required";

export interface EvidenceBatchQaDiffPreviewRow {
  draftId: string;
  table: string;
  field?: string;
  id?: string;
}

export interface EvidenceBatchQaDiffPreview {
  kind: EvidenceBatchQaDiffKind;
  proposedRowCount: number;
  rows: EvidenceBatchQaDiffPreviewRow[];
}

export interface EvidenceBatchQaBlockerMatrixRow {
  category: EvidenceBatchQaBlockerCategory;
  status: EvidenceBatchQaBlockerStatus;
  blockers: string[];
  approvalNotes: string[];
}

export interface EvidenceBatchQaSimulationSummary {
  draftCount: number;
  readyDraftCount: number;
  blockedDraftCount: number;
  targetRowCount: number;
  diffPreviewRowCount: number;
  blockerCategoryCount: number;
}

export interface EvidenceBatchQaSimulationResult {
  readOnly: true;
  dryRun: true;
  noDatabaseWrite: true;
  noPublicEvidenceRowsWritten: true;
  writes: "none";
  approvalRequired: boolean;
  summary: EvidenceBatchQaSimulationSummary;
  diffPreviews: EvidenceBatchQaDiffPreview[];
  blockerMatrix: {
    rows: EvidenceBatchQaBlockerMatrixRow[];
  };
  approvalPacket: string;
}

const DIFF_KINDS: EvidenceBatchQaDiffKind[] = [
  "claim",
  "reference",
  "extraction",
  "score",
  "changelog-public-evidence"
];

const BLOCKER_CATEGORIES: EvidenceBatchQaBlockerCategory[] = [
  "missing-source-packet",
  "extraction-gap",
  "source-rights",
  "claim-review-status",
  "product-level-artg-aust-evidence",
  "public-promotion-readiness"
];

const CLAIM_TABLES = new Set(["ClaimReference", "ReviewEvent"]);
const REFERENCE_TABLES = new Set(["Reference", "SourceCandidate"]);
const EXTRACTION_TABLES = new Set(["Study"]);
const SCORE_TABLES = new Set([
  "ScoreSnapshot",
  "ClaimScoreSnapshot",
  "ScoreHistory",
  "ClaimScoreHistory"
]);
const CHANGELOG_TABLES = new Set(["PublicChangelogEntry", "PublicEvidence"]);

const MISSING_SOURCE_PACKET_SECTIONS = ["reference", "claim-link", "outcome-relevance"] as const;

const EXTRACTION_GAP_KEYWORD =
  /extraction|sample|population|outcome|risk|safety|adverse|funding/i;

const REGULATORY_BLOCKER_KEYWORD = /regulatory|product|tga|artg|aust/i;

const DEFAULT_SOURCE_RIGHTS_BLOCKER =
  "Source terms and usage rights require explicit review before batch promotion.";

const DEFAULT_PRODUCT_LEVEL_BLOCKER =
  "Do not infer product-level ARTG/AUST status from generic evidence; product-level evidence remains required before product status claims.";

export function buildEvidenceBatchQaSimulation(
  input: EvidenceBatchQaSimulationInput
): EvidenceBatchQaSimulationResult {
  const draftRows = input.draftRows ?? [];
  const transactionBoundaryRows = input.transactionBoundaryRows ?? [];

  const diffPreviews = buildDiffPreviews(draftRows, transactionBoundaryRows);
  const blockerRows = buildBlockerMatrixRows(input);
  const readyDraftCount = draftRows.filter(
    (draft) => draft.sourcePacketReadiness.status === "complete-proposed-packet"
  ).length;
  const blockedDraftCount = draftRows.length - readyDraftCount;
  const targetRowCount = draftRows.reduce(
    (count, draft) => count + draft.targetRows.length,
    0
  );
  const diffPreviewRowCount = diffPreviews.reduce(
    (count, preview) => count + preview.proposedRowCount,
    0
  );
  const approvalRequired = blockerRows.some((row) => row.status !== "ready");

  return {
    readOnly: true,
    dryRun: true,
    noDatabaseWrite: true,
    noPublicEvidenceRowsWritten: true,
    writes: "none",
    approvalRequired,
    summary: {
      draftCount: draftRows.length,
      readyDraftCount,
      blockedDraftCount,
      targetRowCount,
      diffPreviewRowCount,
      blockerCategoryCount: BLOCKER_CATEGORIES.length
    },
    diffPreviews,
    blockerMatrix: {
      rows: blockerRows
    },
    approvalPacket: buildApprovalPacket(diffPreviews, blockerRows)
  };
}

function classifyTargetTable(table: string): EvidenceBatchQaDiffKind | null {
  if (CLAIM_TABLES.has(table)) {
    return "claim";
  }
  if (REFERENCE_TABLES.has(table)) {
    return "reference";
  }
  if (EXTRACTION_TABLES.has(table)) {
    return "extraction";
  }
  if (SCORE_TABLES.has(table)) {
    return "score";
  }
  if (CHANGELOG_TABLES.has(table)) {
    return "changelog-public-evidence";
  }
  return null;
}

function buildDiffPreviews(
  draftRows: EvidenceBatchQaDraftRow[],
  transactionBoundaryRows: EvidenceBatchQaTransactionBoundaryRow[]
): EvidenceBatchQaDiffPreview[] {
  const grouped = new Map<EvidenceBatchQaDiffKind, EvidenceBatchQaDiffPreviewRow[]>();

  for (const kind of DIFF_KINDS) {
    grouped.set(kind, []);
  }

  for (const draft of draftRows) {
    for (const targetRow of draft.targetRows) {
      const kind = classifyTargetTable(targetRow.table);
      if (!kind) {
        continue;
      }

      grouped.get(kind)?.push({
        draftId: draft.draftId,
        table: targetRow.table,
        field: targetRow.field,
        id: targetRow.id
      });
    }
  }

  const changelogBoundary = transactionBoundaryRows.find(
    (row) => row.id === "changelog-public-evidence" && row.presentInBatch
  );
  if (changelogBoundary) {
    for (const table of changelogBoundary.targetTables) {
      grouped.get("changelog-public-evidence")?.push({
        draftId: "transaction-boundary",
        table
      });
    }
  }

  return DIFF_KINDS.map((kind) => {
    const rows = grouped.get(kind) ?? [];
    return {
      kind,
      proposedRowCount: rows.length,
      rows
    };
  });
}

function buildBlockerMatrixRows(
  input: EvidenceBatchQaSimulationInput
): EvidenceBatchQaBlockerMatrixRow[] {
  return [
    evaluateMissingSourcePacket(input.draftRows),
    evaluateExtractionGap(input.draftRows),
    evaluateSourceRights(input),
    evaluateClaimReviewStatus(input.draftRows),
    evaluateProductLevelArtgAustEvidence(input.draftRows),
    evaluatePublicPromotionReadiness(input.draftRows, input.transactionBoundaryRows ?? [])
  ];
}

function evaluateMissingSourcePacket(
  draftRows: EvidenceBatchQaDraftRow[]
): EvidenceBatchQaBlockerMatrixRow {
  const blockers: string[] = [];

  for (const draft of draftRows) {
    const readiness = draft.sourcePacketReadiness;
    if (readiness.status !== "complete-proposed-packet") {
      blockers.push(
        `Draft ${draft.draftId}: source packet status is ${readiness.status}, not complete-proposed-packet.`
      );
    }

    for (const sectionId of MISSING_SOURCE_PACKET_SECTIONS) {
      if (readiness.blockedSectionIds.includes(sectionId)) {
        blockers.push(`Draft ${draft.draftId}: blocked source-packet section ${sectionId}.`);
      }
    }
  }

  return {
    category: "missing-source-packet",
    status: blockers.length > 0 ? "blocked" : "ready",
    blockers,
    approvalNotes: []
  };
}

function evaluateExtractionGap(
  draftRows: EvidenceBatchQaDraftRow[]
): EvidenceBatchQaBlockerMatrixRow {
  const blockers: string[] = [];

  for (const draft of draftRows) {
    if (draft.sourcePacketReadiness.blockedSectionIds.includes("study-extraction")) {
      blockers.push(`Draft ${draft.draftId}: study-extraction section is blocked.`);
    }

    for (const blocker of draft.blockers ?? []) {
      if (EXTRACTION_GAP_KEYWORD.test(blocker)) {
        blockers.push(`Draft ${draft.draftId}: ${blocker}`);
      }
    }
  }

  return {
    category: "extraction-gap",
    status: blockers.length > 0 ? "blocked" : "ready",
    blockers,
    approvalNotes: []
  };
}

function evaluateSourceRights(
  input: EvidenceBatchQaSimulationInput
): EvidenceBatchQaBlockerMatrixRow {
  if (input.sourceRightsStatus === "ready") {
    return {
      category: "source-rights",
      status: "ready",
      blockers: [],
      approvalNotes: []
    };
  }

  const blockers =
    input.sourceRightsBlockers && input.sourceRightsBlockers.length > 0
      ? [...input.sourceRightsBlockers]
      : [DEFAULT_SOURCE_RIGHTS_BLOCKER];

  return {
    category: "source-rights",
    status: "blocked",
    blockers,
    approvalNotes: []
  };
}

function evaluateClaimReviewStatus(
  draftRows: EvidenceBatchQaDraftRow[]
): EvidenceBatchQaBlockerMatrixRow {
  const hasClaimReviewTargets = draftRows.some((draft) =>
    draft.targetRows.some((targetRow) => CLAIM_TABLES.has(targetRow.table))
  );

  if (!hasClaimReviewTargets) {
    return {
      category: "claim-review-status",
      status: "ready",
      blockers: [],
      approvalNotes: []
    };
  }

  return {
    category: "claim-review-status",
    status: "review-required",
    blockers: ["Claim or review target rows are present in this batch."],
    approvalNotes: ["Claim review status changes require exact operator approval before write."]
  };
}

function evaluateProductLevelArtgAustEvidence(
  draftRows: EvidenceBatchQaDraftRow[]
): EvidenceBatchQaBlockerMatrixRow {
  const suppliedBlockers: string[] = [];

  for (const draft of draftRows) {
    for (const blocker of draft.blockers ?? []) {
      if (REGULATORY_BLOCKER_KEYWORD.test(blocker)) {
        suppliedBlockers.push(blocker);
      }
    }
  }

  const uniqueBlockers = [...new Set(suppliedBlockers)];
  const blockers =
    uniqueBlockers.length > 0 ? uniqueBlockers : [DEFAULT_PRODUCT_LEVEL_BLOCKER];

  return {
    category: "product-level-artg-aust-evidence",
    status: "review-required",
    blockers,
    approvalNotes: [
      "Product-level ARTG/AUST status cannot be inferred from generic evidence alone."
    ]
  };
}

function evaluatePublicPromotionReadiness(
  draftRows: EvidenceBatchQaDraftRow[],
  transactionBoundaryRows: EvidenceBatchQaTransactionBoundaryRow[]
): EvidenceBatchQaBlockerMatrixRow {
  const hasChangelogOrPublicEvidence = draftRows.some((draft) =>
    draft.targetRows.some((targetRow) => CHANGELOG_TABLES.has(targetRow.table))
  );
  const hasChangelogBoundary = transactionBoundaryRows.some(
    (row) => row.id === "changelog-public-evidence" && row.presentInBatch
  );
  const hasScoreClaimReviewBoundary = transactionBoundaryRows.some(
    (row) => row.presentInBatch && isScoreClaimReviewBoundary(row)
  );

  const reviewRequired =
    hasChangelogOrPublicEvidence || hasChangelogBoundary || hasScoreClaimReviewBoundary;

  if (!reviewRequired) {
    return {
      category: "public-promotion-readiness",
      status: "ready",
      blockers: [],
      approvalNotes: []
    };
  }

  const blockers = ["Public promotion or changelog publication targets are present in this batch."];
  const approvalNotes = [
    "Public evidence promotion requires explicit operator approval.",
    "Public changelog publication requires explicit operator approval."
  ];

  return {
    category: "public-promotion-readiness",
    status: "review-required",
    blockers,
    approvalNotes
  };
}

function isScoreClaimReviewBoundary(
  row: EvidenceBatchQaTransactionBoundaryRow
): boolean {
  const haystack = `${row.id} ${row.label} ${row.requiredWriteApproval}`.toLowerCase();
  return (
    haystack.includes("review") && (haystack.includes("claim") || haystack.includes("score"))
  );
}

function buildApprovalPacket(
  diffPreviews: EvidenceBatchQaDiffPreview[],
  blockerRows: EvidenceBatchQaBlockerMatrixRow[]
): string {
  const diffSection = diffPreviews
    .map((preview) => `- ${preview.kind}: ${preview.proposedRowCount} proposed row(s)`)
    .join("\n");

  const blockerSection = blockerRows
    .map((row) => {
      const lines = [
        `### ${row.category}`,
        `Status: ${row.status}`,
        ...(row.blockers.length > 0
          ? row.blockers.map((blocker) => `- ${blocker}`)
          : ["- No blockers."]),
        ...(row.approvalNotes.length > 0
          ? row.approvalNotes.map((note) => `- Approval note: ${note}`)
          : [])
      ];
      return lines.join("\n");
    })
    .join("\n\n");

  const requiredApprovals = blockerRows.flatMap((row) => row.approvalNotes);
  const requiredApprovalSection =
    requiredApprovals.length > 0
      ? requiredApprovals.map((note) => `- ${note}`).join("\n")
      : "- No additional approvals required for this read-only simulation.";

  return [
    "# Evidence Batch QA Simulation",
    "",
    "Read-only dry-run projection. No database writes or public evidence publication.",
    "",
    "## Diff Preview",
    "",
    diffSection,
    "",
    "## Blocker Matrix",
    "",
    blockerSection,
    "",
    "## Rollback",
    "",
    "No writes were performed. Discard this simulation output without database rollback.",
    "",
    "## Verification",
    "",
    "- readOnly: true",
    "- dryRun: true",
    "- noDatabaseWrite: true",
    "- noPublicEvidenceRowsWritten: true",
    "- writes: none",
    "",
    "## Required Approvals",
    "",
    requiredApprovalSection
  ].join("\n");
}
