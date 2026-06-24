import type {
  OperatorReviewQueueRow,
  OperatorReviewQueueSnapshot
} from "@/lib/operator/review-queue";

export type EvidenceCandidateClusterMatchKind = "dedupe-key" | "source-external-id";

export interface EvidenceCandidateClusterPlan {
  commands: EvidenceCandidateClusterCommand[];
  humanOwned: true;
  nextAction: string;
  noAutomaticCandidateDecision: true;
  noAutomaticExtractionWrite: true;
  noAutomaticPromotion: true;
  noPublicEvidenceRowsWritten: true;
  readOnly: true;
  rows: EvidenceCandidateClusterRow[];
  summary: {
    candidateRows: number;
    acceptedReferenceMatchedClusters: number;
    clusters: number;
    curationBlockedClusters: number;
    duplicateIdentityRows: number;
    duplicateClusters: number;
    highPriorityClusters: number;
    offClaimRiskClusters: number;
    siblingInspectedRows: number;
  };
}

export interface EvidenceCandidateClusterRow {
  candidateCount: number;
  clusterKey: string;
  commands: {
    candidateReviewPacket: string;
    curationStatus: string;
    referenceMatches: string;
    siblings: string;
  };
  curationEvidence: {
    acceptedReferenceId?: string;
    acceptedReferenceMatched: boolean;
    blockers: string[];
    nextAction?: string;
    publicSourcePacketReady?: boolean;
    status?: OperatorReviewQueueRow["curationStatus"];
  };
  humanOwned: true;
  matchKind: EvidenceCandidateClusterMatchKind;
  noAutomaticCandidateDecision: true;
  noAutomaticExtractionWrite: true;
  noAutomaticPromotion: true;
  noPublicEvidenceRowsWritten: true;
  rank: number;
  reviewOrder: {
    blockerSummary: string;
    firstInspectCommand: string;
    firstInspectLabel: string;
    nextHumanAction: string;
    noCandidateDecisionWrite: true;
    noEvidenceExtractionWrite: true;
    noPublicEvidenceRowsWritten: true;
    orderingReason: string;
    reviewState: "blocked-before-decision" | "ready-for-inspection";
    writes: "none";
  };
  reviewRisks: string[];
  reviewerReasons: string[];
  siblingEvidence: {
    duplicateIdentityRows: number;
    inspectedRows: number;
    matchReasons: string[];
    mixedDecisionRows: number;
    relatedContextRows: number;
    reviewCue: string;
    topRows: Array<{
      decision: NonNullable<
        OperatorReviewQueueRow["siblingContext"]
      >["candidateRows"][number]["decision"];
      dedupeKey: string;
      matchReasons: string[];
      title: string;
    }>;
  };
  source: OperatorReviewQueueRow["source"];
  topCandidate: {
    autopilotPriority: number;
    claimFitConfidence: OperatorReviewQueueRow["claimFit"]["confidence"];
    claimFitLabel: string;
    confidenceDisposition: OperatorReviewQueueRow["confidencePolicy"]["disposition"];
    dedupeKey: string;
    recommendation: OperatorReviewQueueRow["autopilot"]["recommendation"];
    sourceConvictionScore: number;
    title: string;
    trialAlertLabel?: string;
  };
}

export interface EvidenceCandidateClusterCommand {
  command: string;
  id: string;
  label: string;
  mode: "read-only";
  purpose: string;
}

export function buildEvidenceCandidateClusterPlan({
  reviewQueue
}: {
  reviewQueue?: OperatorReviewQueueSnapshot;
} = {}): EvidenceCandidateClusterPlan {
  const candidateRows = reviewQueue?.rows ?? [];
  const clusters = candidateClusterRows(candidateRows);
  const duplicateClusters = clusters.filter(
    (cluster) => cluster.candidateCount > 1 || cluster.siblingEvidence.duplicateIdentityRows > 0
  ).length;
  const acceptedReferenceMatchedClusters = clusters.filter(
    (cluster) => cluster.curationEvidence.acceptedReferenceMatched
  ).length;
  const curationBlockedClusters = clusters.filter(
    (cluster) => cluster.curationEvidence.blockers.length > 0
  ).length;
  const highPriorityClusters = clusters.filter(
    (cluster) => cluster.topCandidate.autopilotPriority >= 4
  ).length;
  const offClaimRiskClusters = clusters.filter((cluster) =>
    cluster.reviewRisks.some((risk) => risk.includes("Claim fit"))
  ).length;
  const siblingInspectedRows = clusters.reduce(
    (total, cluster) => total + cluster.siblingEvidence.inspectedRows,
    0
  );
  const duplicateIdentityRows = clusters.reduce(
    (total, cluster) => total + cluster.siblingEvidence.duplicateIdentityRows,
    0
  );

  return {
    commands: candidateClusterPlanCommands(clusters),
    humanOwned: true,
    nextAction:
      clusters[0]?.reviewerReasons[0] ??
      "No pending source-candidate rows are loaded for read-only clustering.",
    noAutomaticCandidateDecision: true,
    noAutomaticExtractionWrite: true,
    noAutomaticPromotion: true,
    noPublicEvidenceRowsWritten: true,
    readOnly: true,
    rows: clusters,
    summary: {
      candidateRows: candidateRows.length,
      acceptedReferenceMatchedClusters,
      clusters: clusters.length,
      curationBlockedClusters,
      duplicateIdentityRows,
      duplicateClusters,
      highPriorityClusters,
      offClaimRiskClusters,
      siblingInspectedRows
    }
  };
}

function candidateClusterRows(rows: OperatorReviewQueueRow[]) {
  const grouped = new Map<string, OperatorReviewQueueRow[]>();

  for (const row of rows) {
    const identity = candidateClusterIdentity(row);
    grouped.set(identity.clusterKey, [...(grouped.get(identity.clusterKey) ?? []), row]);
  }

  return Array.from(grouped.entries())
    .map(([clusterKey, clusterRows]) =>
      candidateClusterRow(clusterKey, clusterRows, candidateClusterIdentity(clusterRows[0]))
    )
    .sort(compareCandidateClusterRows)
    .map((row, index) => ({
      ...row,
      rank: index + 1
    }));
}

function candidateClusterRow(
  clusterKey: string,
  rows: OperatorReviewQueueRow[],
  identity: ReturnType<typeof candidateClusterIdentity>
): EvidenceCandidateClusterRow {
  const sortedRows = [...rows].sort(compareReviewRows);
  const topCandidate = sortedRows[0];

  return {
    candidateCount: rows.length,
    clusterKey,
    commands: {
      candidateReviewPacket: topCandidate.packetPreview.candidateReviewPacketCommand,
      curationStatus: topCandidate.packetPreview.curationStatusCommand,
      referenceMatches: topCandidate.packetPreview.referenceMatchesCommand,
      siblings: topCandidate.packetPreview.siblingsCommand
    },
    curationEvidence: candidateClusterCurationEvidence(topCandidate),
    humanOwned: true,
    matchKind: identity.matchKind,
    noAutomaticCandidateDecision: true,
    noAutomaticExtractionWrite: true,
    noAutomaticPromotion: true,
    noPublicEvidenceRowsWritten: true,
    rank: 0,
    reviewOrder: candidateClusterReviewOrder(topCandidate, rows.length, identity),
    reviewRisks: candidateClusterReviewRisks(topCandidate, rows.length),
    reviewerReasons: candidateClusterReviewerReasons(topCandidate, rows.length, identity),
    siblingEvidence: candidateClusterSiblingEvidence(topCandidate, rows.length),
    source: topCandidate.source,
    topCandidate: {
      autopilotPriority: topCandidate.autopilot.priority,
      claimFitConfidence: topCandidate.claimFit.confidence,
      claimFitLabel: topCandidate.claimFit.label,
      confidenceDisposition: topCandidate.confidencePolicy.disposition,
      dedupeKey: topCandidate.dedupeKey,
      recommendation: topCandidate.autopilot.recommendation,
      sourceConvictionScore: topCandidate.autopilot.sourceConvictionScore,
      title: topCandidate.title,
      ...(topCandidate.trialAlert?.label
        ? { trialAlertLabel: topCandidate.trialAlert.label }
        : {})
    }
  };
}

function candidateClusterIdentity(row: OperatorReviewQueueRow | undefined) {
  const fallback = {
    clusterKey: "unknown|dedupe|unknown",
    matchKind: "dedupe-key" as const
  };

  if (!row) {
    return fallback;
  }

  const externalId = externalIdFromDedupeKey(row);

  if (externalId) {
    return {
      clusterKey: `${row.source}|external-id|${externalId}`,
      matchKind: "source-external-id" as const
    };
  }

  return {
    clusterKey: `${row.source}|dedupe|${normaliseClusterPart(row.dedupeKey)}`,
    matchKind: "dedupe-key" as const
  };
}

function externalIdFromDedupeKey(row: OperatorReviewQueueRow) {
  const parts = row.dedupeKey
    .split(/[:|]/g)
    .map((part) => part.trim())
    .filter(Boolean);
  const lastPart = parts[parts.length - 1];

  if (!lastPart) {
    return undefined;
  }

  if (row.source === "PubMed" && /^\d+$/.test(lastPart)) {
    return lastPart;
  }

  if (row.source === "ClinicalTrials.gov" && /^nct[a-z0-9]+$/i.test(lastPart)) {
    return lastPart.toUpperCase();
  }

  return undefined;
}

function candidateClusterReviewerReasons(
  topCandidate: OperatorReviewQueueRow,
  candidateCount: number,
  identity: ReturnType<typeof candidateClusterIdentity>
) {
  const siblingContext = siblingContextFor(topCandidate);

  return [
    `Review ${topCandidate.title} first: ${topCandidate.autopilot.sourceConvictionScore}/100 source conviction, ${topCandidate.autopilot.recommendation}.`,
    `${candidateCount} candidate row${candidateCount === 1 ? "" : "s"} in this ${identity.matchKind} cluster.`,
    siblingContext.inspectedRows > 0
      ? `${siblingContext.inspectedRows} sibling/context row${siblingContext.inspectedRows === 1 ? "" : "s"} inspected: ${siblingContext.reviewCue}`
      : siblingContext.reviewCue,
    candidateClusterCurationReason(topCandidate),
    topCandidate.claimFit.label,
    topCandidate.nextAction ?? topCandidate.autopilot.nextAction
  ];
}

function candidateClusterReviewOrder(
  topCandidate: OperatorReviewQueueRow,
  candidateCount: number,
  identity: ReturnType<typeof candidateClusterIdentity>
): EvidenceCandidateClusterRow["reviewOrder"] {
  const curationEvidence = candidateClusterCurationEvidence(topCandidate);
  const siblingContext = siblingContextFor(topCandidate);
  const blockerSummary =
    curationEvidence.blockers[0] ??
    (topCandidate.claimFit.confidence === "claim-scoped"
      ? "No curation blocker is loaded; inspect source identity and claim fit before any decision."
      : `Claim fit is ${topCandidate.claimFit.confidence}; inspect exact claim fit before any decision.`);
  const needsSiblingInspection =
    candidateCount > 1 ||
    siblingContext.duplicateIdentityRows > 0 ||
    siblingContext.mixedDecisionRows > 0;
  const firstInspectCommand = needsSiblingInspection
    ? topCandidate.packetPreview.siblingsCommand
    : topCandidate.packetPreview.referenceMatchesCommand;
  const firstInspectLabel = needsSiblingInspection
    ? "Inspect sibling and duplicate rows first"
    : "Inspect reviewed reference matches first";
  const orderingReason = [
    `Rank by priority ${topCandidate.autopilot.priority}`,
    `${topCandidate.autopilot.sourceConvictionScore}/100 source conviction`,
    `${candidateCount} row${candidateCount === 1 ? "" : "s"} in ${identity.matchKind} cluster`,
    ...(needsSiblingInspection
      ? ["sibling/duplicate context must be checked before any decision"]
      : []),
    ...(curationEvidence.blockers.length > 0
      ? ["curation blocker must be resolved before publication review"]
      : [])
  ].join("; ");

  return {
    blockerSummary,
    firstInspectCommand,
    firstInspectLabel,
    nextHumanAction:
      topCandidate.nextAction ??
      topCandidate.autopilot.nextAction ??
      "Inspect this cluster before any candidate decision.",
    noCandidateDecisionWrite: true,
    noEvidenceExtractionWrite: true,
    noPublicEvidenceRowsWritten: true,
    orderingReason,
    reviewState:
      curationEvidence.blockers.length > 0 ||
      topCandidate.claimFit.confidence !== "claim-scoped"
        ? "blocked-before-decision"
        : "ready-for-inspection",
    writes: "none"
  };
}

function candidateClusterReviewRisks(
  topCandidate: OperatorReviewQueueRow,
  candidateCount: number
) {
  const siblingContext = siblingContextFor(topCandidate);

  return [
    ...(candidateCount > 1 || siblingContext.duplicateIdentityRows > 0
      ? ["Review sibling/duplicate rows together before changing any candidate decision."]
      : []),
    ...(siblingContext.mixedDecisionRows > 0
      ? ["Sibling context includes mixed candidate decisions; compare accepted, rejected, and pending rows before any new decision."]
      : []),
    ...candidateClusterCurationEvidence(topCandidate).blockers,
    ...(topCandidate.claimFit.confidence === "claim-scoped"
      ? []
      : [`Claim fit is ${topCandidate.claimFit.confidence}; confirm exact claim fit before accepting.`]),
    ...(topCandidate.confidencePolicy.disposition === "recommend-reject"
      ? ["Confidence policy recommends rejection, but rejection still requires explicit operator approval."]
      : []),
    ...(topCandidate.trialAlert
      ? ["ClinicalTrials.gov alert context must not create score changes or public evidence automatically."]
      : [])
  ];
}

function candidateClusterCurationEvidence(
  topCandidate: OperatorReviewQueueRow
): EvidenceCandidateClusterRow["curationEvidence"] {
  const acceptedReferenceId = topCandidate.aiReview.acceptedReferenceId;
  const status = topCandidate.curationStatus;
  const blockers = [
    ...(status && status !== "Public source packet ready" && status !== "Not accepted"
      ? [`Curation status is ${status}; resolve before publication review.`]
      : []),
    ...(topCandidate.publicSourcePacketReady === false
      ? ["Public source packet is not ready."]
      : [])
  ];

  return {
    ...(acceptedReferenceId ? { acceptedReferenceId } : {}),
    acceptedReferenceMatched: Boolean(acceptedReferenceId),
    blockers,
    ...(topCandidate.nextAction ? { nextAction: topCandidate.nextAction } : {}),
    ...(topCandidate.publicSourcePacketReady !== undefined
      ? { publicSourcePacketReady: topCandidate.publicSourcePacketReady }
      : {}),
    ...(status ? { status } : {})
  };
}

function candidateClusterCurationReason(topCandidate: OperatorReviewQueueRow) {
  const curationEvidence = candidateClusterCurationEvidence(topCandidate);

  if (curationEvidence.acceptedReferenceId) {
    return `Accepted-reference match: ${curationEvidence.acceptedReferenceId}.`;
  }

  if (curationEvidence.status) {
    return `Curation status: ${curationEvidence.status}.`;
  }

  return "No accepted-reference match is prefilled for this cluster.";
}

function candidateClusterSiblingEvidence(
  topCandidate: OperatorReviewQueueRow,
  candidateCount: number
): EvidenceCandidateClusterRow["siblingEvidence"] {
  const siblingContext = siblingContextFor(topCandidate);

  return {
    duplicateIdentityRows: siblingContext.duplicateIdentityRows,
    inspectedRows: siblingContext.inspectedRows,
    matchReasons: siblingContext.matchReasons,
    mixedDecisionRows: siblingContext.mixedDecisionRows,
    relatedContextRows: Math.max(
      candidateCount - 1,
      siblingContext.relatedContextRows
    ),
    reviewCue: siblingContext.reviewCue,
    topRows: siblingContext.candidateRows.map((row) => ({
      decision: row.decision,
      dedupeKey: row.dedupeKey,
      matchReasons: row.matchReasons,
      title: row.title
    }))
  };
}

function siblingContextFor(row: OperatorReviewQueueRow) {
  return row.siblingContext ?? {
    candidateRows: [],
    duplicateIdentityRows: 0,
    inspectedRows: 0,
    matchReasons: [],
    mixedDecisionRows: 0,
    noAutomaticCandidateDecision: true as const,
    noAutomaticExtractionWrite: true as const,
    noAutomaticPromotion: true as const,
    readOnly: true as const,
    relatedContextRows: 0,
    reviewCue: "No sibling rows were found in the bounded read-only inspection."
  };
}

function candidateClusterPlanCommands(
  clusters: EvidenceCandidateClusterRow[]
): EvidenceCandidateClusterCommand[] {
  return [
    {
      command: "npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 10",
      id: "candidate-review-overview",
      label: "Inspect pending candidate overview",
      mode: "read-only",
      purpose:
        "Review pending candidate groups before accepting, rejecting, linking, extracting, or promoting evidence."
    },
    ...clusters.slice(0, 5).flatMap((cluster) => [
      {
        command: cluster.commands.siblings,
        id: `siblings-${cluster.rank}`,
        label: `Inspect siblings for cluster ${cluster.rank}`,
        mode: "read-only" as const,
        purpose:
          "Compare sibling and duplicate context before any candidate decision."
      },
      {
        command: cluster.commands.referenceMatches,
        id: `reference-matches-${cluster.rank}`,
        label: `Inspect reference matches for cluster ${cluster.rank}`,
        mode: "read-only" as const,
        purpose:
          "Check existing reviewed reference matches before any accept decision."
      }
    ])
  ];
}

function compareCandidateClusterRows(
  left: EvidenceCandidateClusterRow,
  right: EvidenceCandidateClusterRow
) {
  return (
    right.topCandidate.autopilotPriority - left.topCandidate.autopilotPriority ||
    right.topCandidate.sourceConvictionScore - left.topCandidate.sourceConvictionScore ||
    right.candidateCount - left.candidateCount ||
    left.topCandidate.title.localeCompare(right.topCandidate.title)
  );
}

function compareReviewRows(left: OperatorReviewQueueRow, right: OperatorReviewQueueRow) {
  return (
    right.autopilot.priority - left.autopilot.priority ||
    right.autopilot.sourceConvictionScore - left.autopilot.sourceConvictionScore ||
    right.triageScore - left.triageScore ||
    left.title.localeCompare(right.title)
  );
}

function normaliseClusterPart(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}
