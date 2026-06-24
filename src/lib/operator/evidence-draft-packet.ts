import type {
  SourceCandidatePromotionReadinessRow,
  SourceCandidatePromotionExtractionPrefillField
} from "@/lib/operator/curation-promotion";
import type { EvidenceCandidateClusterRow } from "@/lib/operator/evidence-candidate-cluster-plan";
import type { OperatorReviewQueueRow } from "@/lib/operator/review-queue";
import type { SourceCandidate, SourceCandidateSource } from "@/lib/types";

export type EvidenceDraftFieldStatus =
  | "blocked"
  | "proposed"
  | "unknown"
  | "verified-existing";

export type EvidenceDraftConfidence = "strong" | "inferred" | "weak" | "missing";

export type EvidenceDraftTargetTable =
  | "ClaimReference"
  | "Reference"
  | "ReviewEvent"
  | "ScoreSnapshot"
  | "SourceCandidate"
  | "Study";

export type EvidenceDraftProvenanceSource =
  | "accepted-reference"
  | "candidate-cluster"
  | "candidate-metadata"
  | "curation-claim-link-draft"
  | "curation-extraction-draft"
  | "curation-status"
  | "operator-review-queue"
  | "promotion-readiness"
  | "review-policy";

export interface EvidenceDraftPacketGuardrails {
  humanOwned: true;
  noAutoCandidateDecision: true;
  noAutoClaimReviewWrite: true;
  noAutoExtractionWrite: true;
  noAutoPromotion: true;
  noAutoPublicEvidenceWrite: true;
  noAutoScoreSnapshot: true;
  readOnly: true;
}

export interface EvidenceDraftProvenance {
  command?: string;
  field?: string;
  label: string;
  source: EvidenceDraftProvenanceSource;
  value?: string;
  writeFlag?: string;
}

export interface EvidenceDraftTargetRow {
  field?: string;
  id?: string;
  table: EvidenceDraftTargetTable;
}

export interface EvidenceDraftField {
  blockers: string[];
  confidence: EvidenceDraftConfidence;
  id: string;
  label: string;
  note: string;
  provenance: EvidenceDraftProvenance[];
  reviewRequired: true;
  status: EvidenceDraftFieldStatus;
  targetRows: EvidenceDraftTargetRow[];
  unknownReason?: string;
  value?: string;
}

export interface EvidenceDraftBlocker {
  id: string;
  label: string;
  nextAction: string;
  source: "candidate-review" | "claim-link" | "publication" | "source-packet" | "study-extraction";
}

export type EvidenceDraftSourcePacketSectionId =
  | "candidate-review"
  | "claim-link"
  | "confidence"
  | "limitations"
  | "outcome-relevance"
  | "reference"
  | "regulatory"
  | "safety"
  | "study-extraction";

export interface EvidenceDraftSourcePacketReadinessSection {
  blockers: string[];
  fieldIds: string[];
  id: EvidenceDraftSourcePacketSectionId;
  label: string;
  missingRequired: boolean;
  status: "blocked" | "ready" | "unknown";
  targetTables: EvidenceDraftTargetTable[];
  unknownReasons: string[];
}

export interface EvidenceDraftSourcePacketReadiness {
  blockedSectionIds: EvidenceDraftSourcePacketSectionId[];
  blockerSummary: string;
  clearBlockerList: string[];
  humanOwned: true;
  nextHumanAction: string;
  noPublicEvidenceRowsWritten: true;
  readOnly: true;
  readySectionIds: EvidenceDraftSourcePacketSectionId[];
  requiredSectionIds: EvidenceDraftSourcePacketSectionId[];
  sections: EvidenceDraftSourcePacketReadinessSection[];
  status: "blocked" | "complete-proposed-packet";
  writes: "none";
}

export interface EvidenceDraftDiffRow {
  after: {
    status: EvidenceDraftFieldStatus;
    value?: string;
  };
  before: {
    status: "existing" | "not-inspected" | "unknown";
    value?: string;
  };
  blockers: string[];
  fieldId: string;
  label: string;
  provenanceCount: number;
  targetRows: EvidenceDraftTargetRow[];
}

export interface EvidenceDraftDiffSnapshot {
  humanOwned: true;
  noDatabaseWrite: true;
  noPublicEvidenceRowsWritten: true;
  readOnly: true;
  rows: EvidenceDraftDiffRow[];
  summary: {
    blockedRows: number;
    proposedRows: number;
    totalRows: number;
    unknownRows: number;
  };
}

export interface EvidenceDraftPacket {
  blockers: EvidenceDraftBlocker[];
  candidate: {
    acceptedReferenceId?: string;
    claimId?: string;
    dedupeKey: string;
    decision?: SourceCandidate["decision"];
    externalId?: string;
    reviewStatus?: SourceCandidate["reviewStatus"];
    source: SourceCandidateSource;
    title: string;
    url?: string;
  };
  candidateReviewOrder?: EvidenceDraftCandidateReviewOrder;
  confidence: {
    disposition?: OperatorReviewQueueRow["confidencePolicy"]["disposition"];
    label?: string;
    rationale: string[];
    score?: number;
  };
  diffSnapshot: EvidenceDraftDiffSnapshot;
  draftId: string;
  fields: EvidenceDraftField[];
  generatedAt: string;
  guardrails: EvidenceDraftPacketGuardrails;
  nextAction: string;
  publication: {
    blockedWriteKinds: EvidenceDraftTargetTable[];
    humanApprovalRequired: true;
    noPublicEvidenceRowsWritten: true;
    status: "draft-only";
  };
  readOnlyCommands: {
    candidateReviewPacket?: string;
    curationDraft?: string;
    curationStatus?: string;
    dryRunPromotion?: string;
    referenceMatches?: string;
    siblings?: string;
  };
  sourcePacketReadiness: EvidenceDraftSourcePacketReadiness;
  uncertaintyLabels: string[];
}

export interface EvidenceDraftCandidateReviewOrder {
  blockerSummary: string;
  clusterKey: string;
  firstInspectCommand: string;
  firstInspectLabel: string;
  nextHumanAction: string;
  noCandidateDecisionWrite: true;
  noEvidenceExtractionWrite: true;
  noPublicEvidenceRowsWritten: true;
  orderingReason: string;
  rank: number;
  reviewState: EvidenceCandidateClusterRow["reviewOrder"]["reviewState"];
  writes: "none";
}

export interface BuildEvidenceDraftPacketOptions {
  candidateClusterRow?: EvidenceCandidateClusterRow;
  generatedAt?: Date;
  promotionReadinessRow?: SourceCandidatePromotionReadinessRow;
  reviewQueueRow?: OperatorReviewQueueRow;
}

const EVIDENCE_DRAFT_GUARDRAILS: EvidenceDraftPacketGuardrails = {
  humanOwned: true,
  noAutoCandidateDecision: true,
  noAutoClaimReviewWrite: true,
  noAutoExtractionWrite: true,
  noAutoPromotion: true,
  noAutoPublicEvidenceWrite: true,
  noAutoScoreSnapshot: true,
  readOnly: true
};

export function buildEvidenceDraftPacket({
  candidateClusterRow,
  generatedAt = new Date(),
  promotionReadinessRow,
  reviewQueueRow
}: BuildEvidenceDraftPacketOptions): EvidenceDraftPacket {
  if (!reviewQueueRow && !promotionReadinessRow) {
    throw new Error("Evidence draft packet requires a review queue or promotion readiness row.");
  }

  const candidate = evidenceDraftCandidate({ promotionReadinessRow, reviewQueueRow });
  const candidateReviewOrder = evidenceDraftCandidateReviewOrder(candidateClusterRow);
  const fields = [
    referenceDraftField({ candidate, promotionReadinessRow, reviewQueueRow }),
    claimLinkDraftField({ candidate, promotionReadinessRow, reviewQueueRow }),
    ...studyExtractionDraftFields({ promotionReadinessRow, reviewQueueRow }),
    ...contextDraftFields({
      candidate,
      candidateReviewOrder,
      promotionReadinessRow,
      reviewQueueRow
    })
  ];
  const blockers = evidenceDraftBlockers({ fields, promotionReadinessRow, reviewQueueRow });
  const diffSnapshot = buildEvidenceDraftDiffSnapshot(fields);
  const sourcePacketReadiness = buildEvidenceDraftSourcePacketReadiness({
    blockers,
    fields
  });

  return {
    blockers,
    candidate,
    confidence: {
      disposition: reviewQueueRow?.confidencePolicy.disposition,
      label: reviewQueueRow?.confidencePolicy.label,
      rationale: reviewQueueRow?.confidencePolicy.rationale ?? [],
      score: reviewQueueRow?.confidencePolicy.score
    },
    ...(candidateReviewOrder ? { candidateReviewOrder } : {}),
    diffSnapshot,
    draftId: `evidence-draft:${candidate.dedupeKey}`,
    fields,
    generatedAt: generatedAt.toISOString(),
    guardrails: EVIDENCE_DRAFT_GUARDRAILS,
    nextAction:
      blockers[0]?.nextAction ??
      "Review the draft packet, then approve explicit candidate, claim-link, extraction, and promotion steps separately.",
    publication: {
      blockedWriteKinds: [
        "SourceCandidate",
        "Reference",
        "ClaimReference",
        "Study",
        "ReviewEvent",
        "ScoreSnapshot"
      ],
      humanApprovalRequired: true,
      noPublicEvidenceRowsWritten: true,
      status: "draft-only"
    },
    readOnlyCommands: evidenceDraftReadOnlyCommands({
      promotionReadinessRow,
      reviewQueueRow
    }),
    sourcePacketReadiness,
    uncertaintyLabels: evidenceDraftUncertaintyLabels(fields)
  };
}

function evidenceDraftCandidateReviewOrder(
  candidateClusterRow?: EvidenceCandidateClusterRow
): EvidenceDraftCandidateReviewOrder | undefined {
  if (!candidateClusterRow) {
    return undefined;
  }

  return {
    blockerSummary: candidateClusterRow.reviewOrder.blockerSummary,
    clusterKey: candidateClusterRow.clusterKey,
    firstInspectCommand: candidateClusterRow.reviewOrder.firstInspectCommand,
    firstInspectLabel: candidateClusterRow.reviewOrder.firstInspectLabel,
    nextHumanAction: candidateClusterRow.reviewOrder.nextHumanAction,
    noCandidateDecisionWrite: true,
    noEvidenceExtractionWrite: true,
    noPublicEvidenceRowsWritten: true,
    orderingReason: candidateClusterRow.reviewOrder.orderingReason,
    rank: candidateClusterRow.rank,
    reviewState: candidateClusterRow.reviewOrder.reviewState,
    writes: "none"
  };
}

function evidenceDraftCandidate({
  promotionReadinessRow,
  reviewQueueRow
}: {
  promotionReadinessRow?: SourceCandidatePromotionReadinessRow;
  reviewQueueRow?: OperatorReviewQueueRow;
}): EvidenceDraftPacket["candidate"] {
  if (promotionReadinessRow) {
    return {
      acceptedReferenceId:
        promotionReadinessRow.candidate.acceptedReferenceId ??
        reviewQueueRow?.aiReview.acceptedReferenceId,
      claimId: promotionReadinessRow.candidate.claimId ?? reviewQueueRow?.claimFit.claimId,
      decision: promotionReadinessRow.candidate.decision,
      dedupeKey: promotionReadinessRow.candidate.dedupeKey,
      externalId: promotionReadinessRow.candidate.externalId,
      reviewStatus: promotionReadinessRow.candidate.reviewStatus,
      source: promotionReadinessRow.candidate.source,
      title: promotionReadinessRow.candidate.title,
      url: reviewQueueRow?.url
    };
  }

  if (!reviewQueueRow) {
    throw new Error("Evidence draft packet requires a candidate row.");
  }

  return {
    acceptedReferenceId: reviewQueueRow.aiReview.acceptedReferenceId,
    claimId: reviewQueueRow.claimFit.claimId,
    dedupeKey: reviewQueueRow.dedupeKey,
    source: reviewQueueRow.source,
    title: reviewQueueRow.title,
    url: reviewQueueRow.url
  };
}

function referenceDraftField({
  candidate,
  promotionReadinessRow,
  reviewQueueRow
}: {
  candidate: EvidenceDraftPacket["candidate"];
  promotionReadinessRow?: SourceCandidatePromotionReadinessRow;
  reviewQueueRow?: OperatorReviewQueueRow;
}): EvidenceDraftField {
  const acceptedReferenceId = candidate.acceptedReferenceId;
  const provenance = [
    ...(reviewQueueRow
      ? [
          provenanceItem({
            command: reviewQueueRow.packetPreview.referenceMatchesCommand,
            label: "Reference match inspection",
            source: "operator-review-queue",
            value: reviewQueueRow.aiReview.acceptedReferenceId
          })
        ]
      : []),
    ...(promotionReadinessRow
      ? [
          provenanceItem({
            label: "Promotion readiness accepted reference",
            source: "promotion-readiness",
            value: promotionReadinessRow.candidate.acceptedReferenceId
          })
        ]
      : [])
  ];

  if (!acceptedReferenceId) {
    return draftField({
      blockers: ["Accepted reference must be matched by Codex/operator review before evidence drafting can become promotable."],
      confidence: "missing",
      id: "reference.accepted",
      label: "Accepted reference",
      note: "The draft can describe candidate identity, but it cannot propose a public reference row without a matched accepted reference.",
      provenance,
      status: "unknown",
      targetRows: [{ table: "Reference" }],
      unknownReason: "No accepted reference ID is available from the candidate review or promotion snapshot."
    });
  }

  return draftField({
    confidence: "strong",
    id: "reference.accepted",
    label: "Accepted reference",
    note: "Reference identity is still review-owned; this draft only carries the matched ID forward.",
    provenance,
    status: "proposed",
    targetRows: [{ id: acceptedReferenceId, table: "Reference" }],
    value: acceptedReferenceId
  });
}

function claimLinkDraftField({
  candidate,
  promotionReadinessRow,
  reviewQueueRow
}: {
  candidate: EvidenceDraftPacket["candidate"];
  promotionReadinessRow?: SourceCandidatePromotionReadinessRow;
  reviewQueueRow?: OperatorReviewQueueRow;
}): EvidenceDraftField {
  const targetClaimId = candidate.claimId;
  const acceptedReferenceId = candidate.acceptedReferenceId;
  const claimFit = reviewQueueRow?.claimFit;
  const provenance = [
    ...(claimFit
      ? [
          provenanceItem({
            field: "claimFit.rationale",
            label: "Claim fit",
            source: "operator-review-queue",
            value: claimFit.rationale.join(" ")
          })
        ]
      : []),
    ...(promotionReadinessRow
      ? [
          provenanceItem({
            field: "promotion.nextAction",
            label: "Promotion readiness claim link",
            source: "promotion-readiness",
            value: promotionReadinessRow.nextAction
          }),
          provenanceItem({
            field: "candidate.claimId",
            label: "Candidate claim target",
            source: "curation-claim-link-draft",
            value: promotionReadinessRow.candidate.claimId
          }),
          provenanceItem({
            field: "candidate.acceptedReferenceId",
            label: "Accepted reference target",
            source: "curation-claim-link-draft",
            value: promotionReadinessRow.candidate.acceptedReferenceId
          }),
          provenanceItem({
            field: "curation.status",
            label: "Curation status",
            source: "curation-status",
            value: promotionReadinessRow.status
          })
        ]
      : [])
  ];

  if (!targetClaimId) {
    return draftField({
      blockers: ["Candidate must be linked to a scoped claim before any evidence-map update can be proposed."],
      confidence: "missing",
      id: "claim-link.target",
      label: "Claim link",
      note: "Intervention-scoped or query-only leads need human claim selection before extraction or promotion.",
      provenance,
      status: "unknown",
      targetRows: [{ table: "ClaimReference" }],
      unknownReason: "No candidate claim ID is available."
    });
  }

  if (!acceptedReferenceId) {
    return draftField({
      blockers: ["Claim link needs an accepted reference ID before a target ClaimReference row can be proposed."],
      confidence: "weak",
      id: "claim-link.target",
      label: "Claim link",
      note: "The candidate is claim-scoped, but the accepted reference is still missing.",
      provenance,
      status: "blocked",
      targetRows: [{ field: targetClaimId, table: "ClaimReference" }],
      value: targetClaimId
    });
  }

  const existingLinkReady =
    promotionReadinessRow?.status === "Public source packet ready" ||
    promotionReadinessRow?.blockers.every(
      (blocker) => blocker !== "Accepted reference must be linked to the candidate claim."
    ) === true;

  return draftField({
    confidence: claimFit?.confidence === "claim-scoped" ? "strong" : "inferred",
    id: "claim-link.target",
    label: "Claim link",
    note: existingLinkReady
      ? "Accepted reference already appears linked to the candidate claim."
      : "This proposes the target claim/reference link for Codex/operator review.",
    provenance,
    status: existingLinkReady ? "verified-existing" : "proposed",
    targetRows: [
      {
        field: `${targetClaimId}:${acceptedReferenceId}`,
        table: "ClaimReference"
      }
    ],
    value: `${targetClaimId} -> ${acceptedReferenceId}`
  });
}

function studyExtractionDraftFields({
  promotionReadinessRow,
  reviewQueueRow
}: {
  promotionReadinessRow?: SourceCandidatePromotionReadinessRow;
  reviewQueueRow?: OperatorReviewQueueRow;
}): EvidenceDraftField[] {
  if (!promotionReadinessRow) {
    return [
      draftField({
        blockers: ["Study extraction fields need a curation draft or human extraction before publication review."],
        confidence: "missing",
        id: "study-extraction.prefill",
        label: "Study extraction prefill",
        note: "No field-level extraction suggestions were available in the supplied snapshots.",
        provenance: reviewQueueRow
          ? [
              provenanceItem({
                command: reviewQueueRow.packetPreview.curationStatusCommand,
                label: "Curation status",
                source: "operator-review-queue",
                value: reviewQueueRow.curationStatus
              })
            ]
          : [],
        status: "unknown",
        targetRows: [{ table: "Study" }],
        unknownReason: "No promotion readiness extraction prefill was supplied."
      })
    ];
  }

  const fields = promotionReadinessRow.extractionPrefill.fieldSuggestions;

  if (fields.length === 0) {
    return [
      draftField({
        blockers: ["Study extraction fields need a curation draft or human extraction before publication review."],
        confidence: "missing",
        id: "study-extraction.prefill",
        label: "Study extraction prefill",
        note: "No field-level extraction suggestions were available in the supplied snapshots.",
        provenance: [
          provenanceItem({
            command: promotionReadinessRow.extractionPrefill.curationDraftCommand,
            field: "sourceTextStatus",
            label: "Curation draft",
            source: "promotion-readiness",
            value: promotionReadinessRow.extractionPrefill.sourceTextStatus
          }),
          provenanceItem({
            command: promotionReadinessRow.extractionPrefill.curationDraftCommand,
            field: "fullTextStatus",
            label: "Full-text status",
            source: "curation-extraction-draft",
            value: promotionReadinessRow.extractionPrefill.fullTextStatus
          })
        ],
        status: "unknown",
        targetRows: [{ table: "Study" }],
        unknownReason: "No promotion readiness extraction prefill fields were available."
      })
    ];
  }

  return fields.map((field) => studyExtractionDraftField(field, promotionReadinessRow));
}

function studyExtractionDraftField(
  field: SourceCandidatePromotionExtractionPrefillField,
  promotionReadinessRow: SourceCandidatePromotionReadinessRow
): EvidenceDraftField {
  const targetReferenceId = promotionReadinessRow.candidate.acceptedReferenceId;
  const manualRequired = field.confidence === "manual-required";
  const confidence = evidenceDraftConfidence(field.reviewConfidence);

  return draftField({
    blockers: manualRequired
      ? [`${field.label} requires human extraction before it can become evidence-map truth.`]
      : [],
    confidence,
    id: `study-extraction.${field.field}`,
    label: field.label,
    note: field.note,
    provenance: [
      ...(manualRequired
        ? []
        : [
            provenanceItem({
              command: promotionReadinessRow.extractionPrefill.curationDraftCommand,
              field: field.field,
              label: "Draft extraction value",
              source: "curation-extraction-draft",
              value: field.value,
              writeFlag: field.writeFlag
            })
          ]),
      provenanceItem({
        command: promotionReadinessRow.extractionPrefill.curationDraftCommand,
        field: field.field,
        label: field.confidenceLabel,
        source: "curation-extraction-draft",
        value: field.confidenceRationale,
        writeFlag: field.writeFlag
      }),
      provenanceItem({
        command: promotionReadinessRow.extractionPrefill.curationDraftCommand,
        field: "sourceTextStatus",
        label: "Source text status",
        source: field.confidence === "candidate-metadata" ? "candidate-metadata" : "curation-status",
        value: promotionReadinessRow.extractionPrefill.sourceTextStatus
      }),
      provenanceItem({
        command: promotionReadinessRow.extractionPrefill.curationDraftCommand,
        field: "fullTextStatus",
        label: "Full-text status",
        source: "curation-extraction-draft",
        value: promotionReadinessRow.extractionPrefill.fullTextStatus
      })
    ],
    status: manualRequired ? "unknown" : "proposed",
    targetRows: [
      {
        field: field.writeFlag ?? field.field,
        id: targetReferenceId,
        table: "Study"
      }
    ],
    unknownReason: manualRequired ? field.confidenceRationale : undefined,
    value: manualRequired ? undefined : field.value
  });
}

function contextDraftFields({
  candidate,
  candidateReviewOrder,
  promotionReadinessRow,
  reviewQueueRow
}: {
  candidate: EvidenceDraftPacket["candidate"];
  candidateReviewOrder?: EvidenceDraftCandidateReviewOrder;
  promotionReadinessRow?: SourceCandidatePromotionReadinessRow;
  reviewQueueRow?: OperatorReviewQueueRow;
}): EvidenceDraftField[] {
  const fields: EvidenceDraftField[] = [
    ...candidateReviewOrderDraftFields({ candidate, candidateReviewOrder }),
    claimOutcomeRelevanceDraftField({ candidate, promotionReadinessRow, reviewQueueRow }),
    confidenceChangeGapDraftField({ candidate, promotionReadinessRow, reviewQueueRow }),
    draftField({
      confidence: "strong",
      id: "limitations.no-overclaim",
      label: "Does not prove",
      note: "The draft must keep source support scoped to the reviewed claim and avoid treating a lead as proof.",
      provenance: [
        provenanceItem({
          label: "Review policy",
          source: "review-policy",
          value: "Drafts do not prove claims and do not promote public evidence."
        })
      ],
      status: "proposed",
      targetRows: [{ table: "ReviewEvent" }],
      value:
        "Does not prove broader outcomes, product-level efficacy, product-level ARTG/AUST status, or claim support beyond the scoped human-reviewed evidence packet."
    }),
    draftField({
      confidence: "strong",
      id: "safety.caveat",
      label: "Safety caveat",
      note: "Safety/adverse-event wording and safety scores require reviewed extraction, not candidate metadata alone.",
      provenance: [
        provenanceItem({
          label: "Review policy",
          source: "review-policy",
          value:
            "Do not change public safety wording or safety scores without reviewed adverse-event, population, interaction, and applicability evidence."
        })
      ],
      status: "proposed",
      targetRows: [{ table: "ReviewEvent" }],
      value:
        "Keep safety claims conservative until adverse events, population/applicability, interactions, and risk-of-bias context are reviewed."
    }),
    draftField({
      confidence: "strong",
      id: "regulatory.au-product-boundary",
      label: "AU/TGA product boundary",
      note: "Generic intervention evidence cannot establish product-level ARTG/AUST status.",
      provenance: [
        provenanceItem({
          label: "Project guardrail",
          source: "review-policy",
          value: "Product-level ARTG/AUST confidence requires product-level evidence."
        })
      ],
      status: "proposed",
      targetRows: [{ table: "ReviewEvent" }],
      value: "Keep Australia/TGA caveats visible and avoid inferring product-level status from this candidate."
    })
  ];

  if (reviewQueueRow?.trialAlert) {
    fields.push(
      draftField({
        confidence: "strong",
        id: "safety.trial-alert",
        label: reviewQueueRow.trialAlert.label,
        note: "ClinicalTrials.gov alerts route monitoring/review work only and do not change scores automatically.",
        provenance: [
          provenanceItem({
            label: "Trial alert",
            source: "operator-review-queue",
            value: reviewQueueRow.trialAlert.detail
          })
        ],
        status: "proposed",
        targetRows: [{ table: "ReviewEvent" }],
        value: reviewQueueRow.trialAlert.detail
      })
    );
  }

  if (promotionReadinessRow?.blockers.length) {
    fields.push(
      draftField({
        blockers: promotionReadinessRow.blockers,
        confidence: "strong",
        id: "publication.blockers",
        label: "Publication blockers",
        note: "Publication remains blocked until each promotion readiness blocker is resolved by a human.",
        provenance: [
          provenanceItem({
            label: "Promotion readiness blockers",
            source: "promotion-readiness",
            value: promotionReadinessRow.blockers.join(" ")
          })
        ],
        status: "blocked",
        targetRows: [{ table: "ScoreSnapshot" }],
        value: promotionReadinessRow.blockers.join(" ")
      })
    );
  }

  if (!candidate.claimId && reviewQueueRow?.claimFit.confidence === "intervention-scoped") {
    fields.push(
      draftField({
        blockers: ["Human claim selection is required before this intervention-scoped candidate can be drafted as claim evidence."],
        confidence: "missing",
        id: "uncertainty.claim-scope",
        label: "Claim scope uncertainty",
        note: reviewQueueRow.claimFit.reviewCue,
        provenance: [
          provenanceItem({
            label: reviewQueueRow.claimFit.label,
            source: "operator-review-queue",
            value: reviewQueueRow.claimFit.rationale.join(" ")
          })
        ],
        status: "unknown",
        targetRows: [{ table: "ClaimReference" }],
        unknownReason: "Candidate has intervention context but no claim ID."
      })
    );
  }

  return fields;
}

function candidateReviewOrderDraftFields({
  candidate,
  candidateReviewOrder
}: {
  candidate: EvidenceDraftPacket["candidate"];
  candidateReviewOrder?: EvidenceDraftCandidateReviewOrder;
}): EvidenceDraftField[] {
  if (!candidateReviewOrder) {
    return [];
  }

  const blocked = candidateReviewOrder.reviewState === "blocked-before-decision";

  return [
    draftField({
      blockers: blocked ? [candidateReviewOrder.blockerSummary] : [],
      confidence: blocked ? "weak" : "strong",
      id: "candidate-review.order",
      label: "Candidate review order",
      note:
        "Candidate cluster review order is read-only routing context; it cannot accept, reject, extract, score, or promote evidence.",
      provenance: [
        provenanceItem({
          command: candidateReviewOrder.firstInspectCommand,
          field: "reviewOrder.orderingReason",
          label: "Cluster ordering reason",
          source: "candidate-cluster",
          value: candidateReviewOrder.orderingReason
        }),
        provenanceItem({
          command: candidateReviewOrder.firstInspectCommand,
          field: "reviewOrder.blockerSummary",
          label: candidateReviewOrder.firstInspectLabel,
          source: "candidate-cluster",
          value: candidateReviewOrder.blockerSummary
        })
      ],
      status: blocked ? "blocked" : "proposed",
      targetRows: [{ id: candidate.dedupeKey, table: "SourceCandidate" }],
      unknownReason: blocked
        ? "Candidate cluster review order is blocked before any candidate decision."
        : undefined,
      value: `${candidateReviewOrder.reviewState}: ${candidateReviewOrder.firstInspectLabel}; ${candidateReviewOrder.orderingReason}`
    })
  ];
}

function claimOutcomeRelevanceDraftField({
  candidate,
  promotionReadinessRow,
  reviewQueueRow
}: {
  candidate: EvidenceDraftPacket["candidate"];
  promotionReadinessRow?: SourceCandidatePromotionReadinessRow;
  reviewQueueRow?: OperatorReviewQueueRow;
}): EvidenceDraftField {
  const targetClaimId = candidate.claimId;
  const acceptedReferenceId = candidate.acceptedReferenceId;
  const claimFit = reviewQueueRow?.claimFit;
  const provenance = [
    ...(claimFit
      ? [
          provenanceItem({
            field: "claimFit.confidence",
            label: claimFit.label,
            source: "operator-review-queue",
            value: claimFit.rationale.join(" ")
          })
        ]
      : []),
    ...(promotionReadinessRow
      ? [
          provenanceItem({
            field: "curation.status",
            label: "Curation status",
            source: "curation-status",
            value: promotionReadinessRow.status
          }),
          provenanceItem({
            field: "candidate.claimId",
            label: "Candidate claim target",
            source: "curation-claim-link-draft",
            value: promotionReadinessRow.candidate.claimId
          })
        ]
      : [])
  ];

  if (!targetClaimId) {
    return draftField({
      blockers: ["Outcome relevance cannot be drafted without a scoped claim."],
      confidence: "missing",
      id: "claim-link.outcome-relevance",
      label: "Outcome relevance",
      note: "ClaimReference relevance must stay human-owned and claim-specific.",
      provenance,
      status: "unknown",
      targetRows: [{ table: "ClaimReference" }],
      unknownReason: "No scoped candidate claim ID is available for outcome relevance review."
    });
  }

  if (!acceptedReferenceId) {
    return draftField({
      blockers: ["Outcome relevance needs an accepted reference before a ClaimReference relevance target can be reviewed."],
      confidence: "weak",
      id: "claim-link.outcome-relevance",
      label: "Outcome relevance",
      note: claimFit?.reviewCue ?? "Confirm source support for the scoped claim outcome before setting relevance.",
      provenance,
      status: "blocked",
      targetRows: [{ field: `${targetClaimId}:relevance`, table: "ClaimReference" }],
      unknownReason: "Accepted reference ID is missing.",
      value: targetClaimId
    });
  }

  const claimScoped = claimFit?.confidence === "claim-scoped";

  if (!claimScoped) {
    return draftField({
      blockers: ["Human reviewer must confirm outcome relevance before any ClaimReference relevance is written."],
      confidence: claimFit ? "weak" : "missing",
      id: "claim-link.outcome-relevance",
      label: "Outcome relevance",
      note: claimFit?.reviewCue ?? "No claim-fit snapshot was supplied with this draft packet.",
      provenance,
      status: "unknown",
      targetRows: [
        {
          field: `${targetClaimId}:${acceptedReferenceId}:relevance`,
          table: "ClaimReference"
        }
      ],
      unknownReason: claimFit
        ? "Candidate is not confirmed claim-scoped by the review queue snapshot."
        : "No claim-fit snapshot was supplied; review source against the claim outcome before setting relevance."
    });
  }

  return draftField({
    confidence: "strong",
    id: "claim-link.outcome-relevance",
    label: "Outcome relevance",
    note: claimFit.reviewCue,
    provenance,
    status: "proposed",
    targetRows: [
      {
        field: `${targetClaimId}:${acceptedReferenceId}:relevance`,
        table: "ClaimReference"
      }
    ],
    value: `${targetClaimId} / claim-scoped outcome relevance requires human confirmation`
  });
}

function confidenceChangeGapDraftField({
  candidate,
  promotionReadinessRow,
  reviewQueueRow
}: {
  candidate: EvidenceDraftPacket["candidate"];
  promotionReadinessRow?: SourceCandidatePromotionReadinessRow;
  reviewQueueRow?: OperatorReviewQueueRow;
}): EvidenceDraftField {
  const manualExtractionFields =
    promotionReadinessRow?.extractionPrefill.fieldSuggestions
      .filter((field) => field.confidence === "manual-required")
      .map((field) => field.label) ?? [];
  const blockers = [
    ...(promotionReadinessRow?.blockers ?? []),
    ...manualExtractionFields.map((field) => `${field} needs human extraction.`)
  ];
  const provenance = [
    ...(reviewQueueRow
      ? [
          provenanceItem({
            field: "confidencePolicy.rationale",
            label: reviewQueueRow.confidencePolicy.label,
            source: "operator-review-queue",
            value: reviewQueueRow.confidencePolicy.rationale.join(" ")
          }),
          provenanceItem({
            field: "autopilot.nextAction",
            label: "Candidate review next action",
            source: "operator-review-queue",
            value: reviewQueueRow.autopilot.nextAction
          })
        ]
      : []),
    ...(promotionReadinessRow
      ? [
          provenanceItem({
            field: "promotion.nextAction",
            label: "Promotion readiness next action",
            source: "promotion-readiness",
            value: promotionReadinessRow.nextAction
          }),
          provenanceItem({
            field: "extractionPrefill.fieldSuggestions",
            label: "Manual extraction gaps",
            source: "curation-extraction-draft",
            value: manualExtractionFields.join(", ")
          })
        ]
      : [])
  ];
  const status = blockers.length > 0 ? "blocked" : "proposed";

  return draftField({
    blockers,
    confidence: blockers.length > 0 ? "weak" : "strong",
    id: "confidence.change-gap",
    label: "Confidence-changing gap",
    note:
      "Score snapshots remain blocked until candidate decision, claim link, extraction, and promotion review are explicitly approved.",
    provenance,
    status,
    targetRows: [
      {
        ...(candidate.claimId ? { field: candidate.claimId } : {}),
        table: "ScoreSnapshot"
      }
    ],
    unknownReason:
      blockers.length > 0
        ? "Promotion or extraction blockers remain unresolved."
        : undefined,
    value:
      blockers.length > 0
        ? blockers.join(" ")
        : "Human-reviewed promotion packet could support a later explicit score snapshot review."
  });
}

const EVIDENCE_DRAFT_SOURCE_PACKET_SECTIONS: Array<{
  id: EvidenceDraftSourcePacketSectionId;
  label: string;
  required: boolean;
  matches: (field: EvidenceDraftField) => boolean;
}> = [
  {
    id: "candidate-review",
    label: "Candidate review",
    matches: (field) => field.id.startsWith("candidate-review"),
    required: false
  },
  {
    id: "reference",
    label: "Accepted reference",
    matches: (field) => field.id === "reference.accepted",
    required: true
  },
  {
    id: "claim-link",
    label: "Claim link",
    matches: (field) => field.id === "claim-link.target",
    required: true
  },
  {
    id: "outcome-relevance",
    label: "Outcome relevance",
    matches: (field) => field.id === "claim-link.outcome-relevance",
    required: true
  },
  {
    id: "study-extraction",
    label: "Study extraction",
    matches: (field) => field.id.startsWith("study-extraction"),
    required: true
  },
  {
    id: "limitations",
    label: "Does not prove",
    matches: (field) => field.id === "limitations.no-overclaim",
    required: true
  },
  {
    id: "safety",
    label: "Safety caveat",
    matches: (field) => field.id === "safety.caveat",
    required: true
  },
  {
    id: "regulatory",
    label: "AU/TGA product boundary",
    matches: (field) => field.id === "regulatory.au-product-boundary",
    required: true
  },
  {
    id: "confidence",
    label: "Confidence-changing gap",
    matches: (field) => field.id === "confidence.change-gap",
    required: true
  }
];

function buildEvidenceDraftSourcePacketReadiness({
  blockers,
  fields
}: {
  blockers: EvidenceDraftBlocker[];
  fields: EvidenceDraftField[];
}): EvidenceDraftSourcePacketReadiness {
  const sections = EVIDENCE_DRAFT_SOURCE_PACKET_SECTIONS.flatMap(
    (definition): EvidenceDraftSourcePacketReadinessSection[] => {
      const sectionFields = fields.filter(definition.matches);
      const candidateReviewBlockers =
        definition.id === "candidate-review"
          ? blockers
              .filter((blocker) => blocker.source === "candidate-review")
              .map((blocker) => blocker.label)
          : [];
      const includeSection =
        definition.required ||
        sectionFields.length > 0 ||
        candidateReviewBlockers.length > 0;

      if (!includeSection) {
        return [];
      }

      const fieldBlockers = sectionFields.flatMap((field) => field.blockers);
      const unknownReasons = [
        ...(definition.required && sectionFields.length === 0
          ? [`${definition.label} section is missing from the draft packet.`]
          : []),
        ...sectionFields
          .filter((field) => field.status === "unknown")
          .map(
            (field) =>
              field.unknownReason ?? `${field.label} is unknown and needs human review.`
          )
      ];
      const sectionBlockers = uniqueStrings([
        ...candidateReviewBlockers,
        ...fieldBlockers
      ]);
      const missingRequired = definition.required && sectionFields.length === 0;
      const hasBlockedField = sectionFields.some((field) => field.status === "blocked");
      const hasUnknownField = sectionFields.some((field) => field.status === "unknown");
      const ready =
        !missingRequired &&
        sectionBlockers.length === 0 &&
        !hasBlockedField &&
        !hasUnknownField &&
        sectionFields.length > 0 &&
        sectionFields.every(
          (field) => field.status === "proposed" || field.status === "verified-existing"
        );
      const status = ready
        ? "ready"
        : sectionBlockers.length > 0 || hasBlockedField
          ? "blocked"
          : "unknown";

      return [
        {
          blockers: sectionBlockers,
          fieldIds: sectionFields.map((field) => field.id),
          id: definition.id,
          label: definition.label,
          missingRequired,
          status,
          targetTables: uniqueTargetTables(
            sectionFields.flatMap((field) => field.targetRows.map((row) => row.table))
          ),
          unknownReasons: uniqueStrings(unknownReasons)
        }
      ];
    }
  );
  const clearBlockerList = uniqueStrings([
    ...blockers.map((blocker) => blocker.label),
    ...sections
      .filter((section) => section.status !== "ready")
      .flatMap((section) => [
        ...section.blockers,
        ...section.unknownReasons,
        ...(section.blockers.length === 0 && section.unknownReasons.length === 0
          ? [`${section.label} is ${section.status}.`]
          : [])
      ])
  ]);
  const status =
    clearBlockerList.length === 0 && sections.every((section) => section.status === "ready")
      ? "complete-proposed-packet"
      : "blocked";
  const blockedSectionIds = sections
    .filter((section) => section.status !== "ready")
    .map((section) => section.id);

  return {
    blockedSectionIds,
    blockerSummary:
      status === "complete-proposed-packet"
        ? "All required source-packet draft sections are proposed or verified-existing; final writes remain AI-reviewed unless a human explicitly confirms them."
        : `${clearBlockerList.length} blocker(s) or unknown(s): ${clearBlockerList
            .slice(0, 3)
            .join(" | ")}`,
    clearBlockerList,
    humanOwned: true,
    nextHumanAction:
      status === "complete-proposed-packet"
        ? "Review the complete proposed packet before any explicit candidate, extraction, scoring, or publication action."
        : `Resolve ${blockedSectionIds.slice(0, 3).join(" | ") || "draft"} blockers before treating this draft as complete.`,
    noPublicEvidenceRowsWritten: true,
    readOnly: true,
    readySectionIds: sections
      .filter((section) => section.status === "ready")
      .map((section) => section.id),
    requiredSectionIds: sections
      .filter((section) => section.id !== "candidate-review" || section.fieldIds.length > 0)
      .map((section) => section.id),
    sections,
    status,
    writes: "none"
  };
}

function evidenceDraftBlockers({
  fields,
  promotionReadinessRow,
  reviewQueueRow
}: {
  fields: EvidenceDraftField[];
  promotionReadinessRow?: SourceCandidatePromotionReadinessRow;
  reviewQueueRow?: OperatorReviewQueueRow;
}): EvidenceDraftBlocker[] {
  const blockers: EvidenceDraftBlocker[] = [];

  for (const blocker of reviewQueueRow?.aiReview.approvalBlockers ?? []) {
    blockers.push({
      id: `candidate-review:${slug(blocker)}`,
      label: blocker,
      nextAction: "Resolve source-candidate review blockers before treating this draft as operator-approvable.",
      source: "candidate-review"
    });
  }

  for (const blocker of promotionReadinessRow?.blockers ?? []) {
    blockers.push({
      id: `promotion:${slug(blocker)}`,
      label: blocker,
      nextAction: promotionReadinessRow?.nextAction ?? "Resolve promotion readiness blockers.",
      source: blocker.includes("link")
        ? "claim-link"
        : blocker.includes("structured study extraction")
          ? "study-extraction"
          : "publication"
    });
  }

  for (const field of fields) {
    for (const blocker of field.blockers) {
      blockers.push({
        id: `${field.id}:${slug(blocker)}`,
        label: blocker,
        nextAction: field.unknownReason ?? field.note,
        source: field.id.startsWith("study-extraction")
          ? "study-extraction"
          : field.id.startsWith("candidate-review")
            ? "candidate-review"
          : field.id.startsWith("claim-link")
            ? "claim-link"
            : "source-packet"
      });
    }
  }

  return uniqueBlockers(blockers);
}

function evidenceDraftReadOnlyCommands({
  promotionReadinessRow,
  reviewQueueRow
}: {
  promotionReadinessRow?: SourceCandidatePromotionReadinessRow;
  reviewQueueRow?: OperatorReviewQueueRow;
}): EvidenceDraftPacket["readOnlyCommands"] {
  return {
    candidateReviewPacket: reviewQueueRow?.packetPreview.candidateReviewPacketCommand,
    curationDraft:
      promotionReadinessRow?.extractionPrefill.curationDraftCommand ??
      reviewQueueRow?.packetPreview.curationStatusCommand,
    curationStatus: reviewQueueRow?.packetPreview.curationStatusCommand,
    dryRunPromotion: promotionReadinessRow?.actionPreview.dryRunCommand,
    referenceMatches: reviewQueueRow?.packetPreview.referenceMatchesCommand,
    siblings: reviewQueueRow?.packetPreview.siblingsCommand
  };
}

function buildEvidenceDraftDiffSnapshot(
  fields: EvidenceDraftField[]
): EvidenceDraftDiffSnapshot {
  const rows = fields.map((field): EvidenceDraftDiffRow => {
    const verifiedExisting = field.status === "verified-existing";

    return {
      after: {
        status: field.status,
        ...(field.value ? { value: field.value } : {})
      },
      before: {
        status: verifiedExisting ? "existing" : "not-inspected",
        ...(verifiedExisting && field.value ? { value: field.value } : {})
      },
      blockers: field.blockers,
      fieldId: field.id,
      label: field.label,
      provenanceCount: field.provenance.length,
      targetRows: field.targetRows
    };
  });

  return {
    humanOwned: true,
    noDatabaseWrite: true,
    noPublicEvidenceRowsWritten: true,
    readOnly: true,
    rows,
    summary: {
      blockedRows: rows.filter((row) => row.after.status === "blocked").length,
      proposedRows: rows.filter((row) => row.after.status === "proposed").length,
      totalRows: rows.length,
      unknownRows: rows.filter((row) => row.after.status === "unknown").length
    }
  };
}

function evidenceDraftUncertaintyLabels(fields: EvidenceDraftField[]) {
  const labels: string[] = [];

  if (
    fields.some(
      (field) =>
        field.id === "reference.accepted" &&
        field.status !== "proposed" &&
        field.status !== "verified-existing"
    )
  ) {
    labels.push("accepted-reference-unknown");
  }

  if (
    fields.some(
      (field) =>
        field.id === "claim-link.target" &&
        field.status !== "proposed" &&
        field.status !== "verified-existing"
    )
  ) {
    labels.push("claim-link-unknown");
  }

  if (
    fields.some(
      (field) => field.id.startsWith("study-extraction") && field.status === "unknown"
    )
  ) {
    labels.push("manual-extraction-required");
  }

  if (fields.some((field) => field.id === "publication.blockers" || field.blockers.length > 0)) {
    labels.push("publication-blocked");
  }

  return labels;
}

interface EvidenceDraftFieldInput extends Omit<EvidenceDraftField, "blockers" | "reviewRequired"> {
  blockers?: string[];
}

function draftField({
  blockers = [],
  confidence,
  id,
  label,
  note,
  provenance,
  status,
  targetRows,
  unknownReason,
  value
}: EvidenceDraftFieldInput): EvidenceDraftField {
  return {
    blockers,
    confidence,
    id,
    label,
    note,
    provenance,
    reviewRequired: true,
    status,
    targetRows,
    ...(unknownReason ? { unknownReason } : {}),
    ...(value ? { value } : {})
  };
}

function provenanceItem({
  command,
  field,
  label,
  source,
  value,
  writeFlag
}: EvidenceDraftProvenance): EvidenceDraftProvenance {
  return {
    ...(command ? { command } : {}),
    ...(field ? { field } : {}),
    label,
    source,
    ...(value ? { value } : {}),
    ...(writeFlag ? { writeFlag } : {})
  };
}

function evidenceDraftConfidence(
  confidence: SourceCandidatePromotionExtractionPrefillField["reviewConfidence"]
): EvidenceDraftConfidence {
  if (confidence === "strong") {
    return "strong";
  }

  if (confidence === "inferred") {
    return "inferred";
  }

  if (confidence === "weak") {
    return "weak";
  }

  return "missing";
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function uniqueTargetTables(values: EvidenceDraftTargetTable[]) {
  return Array.from(new Set(values));
}

function uniqueBlockers(blockers: EvidenceDraftBlocker[]) {
  const seen = new Set<string>();

  return blockers.filter((blocker) => {
    const key = `${blocker.source}:${blocker.label}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
