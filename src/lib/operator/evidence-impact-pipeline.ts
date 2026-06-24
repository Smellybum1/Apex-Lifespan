import { OperatorRole, OperatorStatus } from "@prisma/client";

import {
  listSourceCandidateCurationHandoff,
  listSourceCandidateReviewQueue,
  type SourceCandidateCurationStatus
} from "@/lib/data/source-candidates";
import { prisma } from "@/lib/db/prisma";
import type { OperatorPermission, OperatorPrincipal } from "@/lib/operator/authorization";
import { assessSourceCandidatePublicPromotion } from "@/lib/operator/curation-promotion";
import {
  linkSourceCandidateClaimAsOperator,
  promoteSourceCandidatePublicEvidenceAsOperator
} from "@/lib/operator/source-candidate-actions";

const PROMOTION_AUDIT_ACTION = "sourceCandidate.publicEvidencePromotion";
const WRITE_ENV = {
  APEX_OPERATOR_WRITES_ENABLED: "true"
};

type ImpactPipelineOperatorUser = {
  email: string | null;
  id: string;
  operatorProfile: {
    role: OperatorRole;
    status: OperatorStatus;
  } | null;
};

export type EvidenceImpactPipelineActionKind =
  | "claim-link"
  | "public-promotion"
  | "extraction-needed"
  | "already-promoted"
  | "blocked";

export type EvidenceImpactPipelineActionStatus =
  | "would-apply"
  | "applied"
  | "blocked"
  | "skipped";

export interface EvidenceImpactPipelineAction {
  blockers: string[];
  claimId?: string;
  command?: string;
  dedupeKey: string;
  details?: Record<string, unknown>;
  externalId: string;
  kind: EvidenceImpactPipelineActionKind;
  reason: string;
  source: SourceCandidateCurationStatus["candidate"]["source"];
  status: EvidenceImpactPipelineActionStatus;
  title: string;
  writePreview: EvidenceImpactPipelineWritePreview;
}

export interface EvidenceImpactPipelineWritePreview {
  approvalRequest?: EvidenceImpactPipelineApprovalRequest;
  commandCopy: string[];
  preWriteChecks: string[];
  rollbackNotes: string[];
  transactionality: "no-write" | "operator-action" | "single-transaction";
  verification: string[];
  writeScope: string[];
}

export interface EvidenceImpactPipelineApprovalRequest {
  approvalDecision: "required-before-write-command";
  approvalPhrase: string;
  approvalScope: string[];
  command: string;
  noDatabaseWrite: true;
  noPublicEvidenceRowsWritten: true;
  requiredInputs: string[];
  requiredOperatorPermissions: OperatorPermission[];
  status: "approval-required";
  stopConditions: string[];
  target: {
    claimId?: string;
    dedupeKey: string;
    externalId: string;
    referenceId?: string;
    reviewStatus: "AI reviewed";
    source: SourceCandidateCurationStatus["candidate"]["source"];
  };
  writes: "none";
}

export interface EvidenceImpactPipelineUpstreamLead {
  claimId?: string;
  command: string;
  curationStatusCommand: string;
  dedupeKey: string;
  decision: "Pending review";
  externalId: string;
  interventionId?: string;
  noAutomaticCandidateDecision: true;
  noAutomaticExtractionWrite: true;
  noAutomaticPromotion: true;
  reason: string;
  referenceMatchesCommand: string;
  reviewStatus: "Unreviewed AI draft" | "AI reviewed" | "Human reviewed";
  source: SourceCandidateCurationStatus["candidate"]["source"];
  title: string;
  triageScore: number;
}

export interface EvidenceImpactPipelineOptions {
  actorEmail?: string;
  forcePromote?: boolean;
  fixture?: EvidenceImpactPipelineFixture;
  limit?: number;
  upstreamLimit?: number;
  write?: boolean;
}

export type EvidenceImpactPipelineFixture = "ready-public-promotion";

export interface EvidenceImpactPipelineResult {
  applied: EvidenceImpactPipelineAction[];
  blocked: EvidenceImpactPipelineAction[];
  dryRun: boolean;
  principal?: {
    email: string;
    role: OperatorRole;
    userId: string;
  };
  scanned: number;
  skipped: EvidenceImpactPipelineAction[];
  summary: {
    applied: number;
    blocked: number;
    scanned: number;
    skipped: number;
    upstreamLeads: number;
    wouldApply: number;
  };
  upstreamLeads: EvidenceImpactPipelineUpstreamLead[];
  warnings: string[];
  wouldApply: EvidenceImpactPipelineAction[];
}

export interface EvidenceImpactPipelinePlanInput {
  alreadyPromoted?: boolean;
  forcePromote?: boolean;
  promotionBlockers?: string[];
  promotionReady?: boolean;
  status: SourceCandidateCurationStatus;
}

export async function runEvidenceImpactPipeline({
  actorEmail,
  forcePromote = false,
  fixture,
  limit = 25,
  upstreamLimit = 3,
  write = false
}: EvidenceImpactPipelineOptions = {}): Promise<EvidenceImpactPipelineResult> {
  if (fixture) {
    if (write) {
      throw new Error(
        "Evidence impact fixture mode is dry-run only; remove --write or run without --fixture-ready."
      );
    }

    return buildEvidenceImpactPipelineFixtureResult(fixture);
  }

  let statuses: SourceCandidateCurationStatus[];
  let upstreamLeads: EvidenceImpactPipelineUpstreamLead[];
  let promotedKeys: Set<string>;

  try {
    statuses = await listSourceCandidateCurationHandoff({ limit });
    upstreamLeads = await listEvidenceImpactPipelineUpstreamLeads(upstreamLimit);
    promotedKeys = await listPromotedSourceCandidateDedupeKeys(
      statuses.map((status) => status.candidate.dedupeKey)
    );
  } catch (error) {
    if (!write && isDatabaseConnectionError(error)) {
      return buildEvidenceImpactPipelineResult({
        applied: [],
        blocked: [],
        dryRun: true,
        scanned: 0,
        skipped: [],
        upstreamLeads: [],
        warnings: [
          "Database is not reachable; evidence-impact dry-run returned an empty read-only fallback. Start the local database to scan source-candidate curation rows."
        ],
        wouldApply: []
      });
    }

    throw error;
  }

  const plannedActions: EvidenceImpactPipelineAction[] = [];

  for (const status of statuses) {
    const alreadyPromoted = promotedKeys.has(status.candidate.dedupeKey);
    const assessment =
      status.status === "Public source packet ready" && (!alreadyPromoted || forcePromote)
        ? await assessSourceCandidatePublicPromotion(status.candidate.dedupeKey)
        : undefined;

    plannedActions.push(
      planEvidenceImpactAction({
        alreadyPromoted,
        forcePromote,
        promotionBlockers: assessment?.blockers,
        promotionReady: assessment?.ready,
        status
      })
    );
  }

  const applicable = plannedActions.filter((action) => action.status === "would-apply");
  const blocked = plannedActions.filter((action) => action.status === "blocked");
  const skipped = plannedActions.filter((action) => action.status === "skipped");

  if (!write || applicable.length === 0) {
    return buildEvidenceImpactPipelineResult({
      applied: [],
      blocked,
      dryRun: !write,
      scanned: statuses.length,
      skipped,
      upstreamLeads,
      wouldApply: applicable
    });
  }

  const principal = await resolveImpactPipelinePrincipal(actorEmail);
  const applied: EvidenceImpactPipelineAction[] = [];
  const writeBlocked = [...blocked];

  for (const action of applicable) {
    try {
      applied.push(await applyEvidenceImpactAction(principal, action));
    } catch (error) {
      writeBlocked.push({
        ...action,
        blockers: [error instanceof Error ? error.message : String(error)],
        reason: `Write failed: ${error instanceof Error ? error.message : String(error)}`,
        status: "blocked"
      });
    }
  }

  return buildEvidenceImpactPipelineResult({
    applied,
    blocked: writeBlocked,
    dryRun: false,
    principal,
    scanned: statuses.length,
    skipped,
    upstreamLeads,
    wouldApply: []
  });
}

function buildEvidenceImpactPipelineFixtureResult(
  fixture: EvidenceImpactPipelineFixture
) {
  const status = evidenceImpactPipelineFixtureStatus(fixture);
  const action = planEvidenceImpactAction({
    promotionReady: true,
    status
  });

  return buildEvidenceImpactPipelineResult({
    applied: [],
    blocked: action.status === "blocked" ? [action] : [],
    dryRun: true,
    scanned: 1,
    skipped: action.status === "skipped" ? [action] : [],
    upstreamLeads: [],
    warnings: [
      "Fixture mode: deterministic no-DB evidence-impact dry run; no database rows were read or written."
    ],
    wouldApply: action.status === "would-apply" ? [action] : []
  });
}

function evidenceImpactPipelineFixtureStatus(
  fixture: EvidenceImpactPipelineFixture
): SourceCandidateCurationStatus {
  if (fixture !== "ready-public-promotion") {
    throw new Error(`Unknown evidence impact pipeline fixture: ${fixture}`);
  }

  return {
    acceptedReference: {
      id: "fixture-ref-pubmed-42141930",
      identifier: "42141930",
      source: "PubMed",
      title: "Creatine supplementation and resistance training outcomes",
      url: "https://pubmed.ncbi.nlm.nih.gov/42141930/",
      year: 2026
    },
    acceptedReferenceId: "fixture-ref-pubmed-42141930",
    candidate: {
      acceptedReferenceId: "fixture-ref-pubmed-42141930",
      claimId: "creatine-strength",
      decision: "Accepted",
      dedupeKey: "fixture|pubmed|creatine-strength|42141930",
      externalId: "42141930",
      interventionId: "creatine",
      metadata: {
        fixture: true,
        reviewStatus: "AI reviewed"
      },
      query: "creatine resistance training strength",
      region: "AU",
      reviewStatus: "AI reviewed",
      source: "PubMed",
      title: "Creatine supplementation and resistance training outcomes",
      triageReasons: [
        "Fixture ready packet with accepted reference, claim link, extraction, and promotion readiness."
      ],
      triageScore: 92,
      url: "https://pubmed.ncbi.nlm.nih.gov/42141930/"
    },
    candidateClaimLinked: true,
    claimLinks: [
      {
        claimId: "creatine-strength",
        note: "Fixture claim-reference link for no-DB evidence-impact rehearsal.",
        relevance: 5
      }
    ],
    nextAction: "Fixture public source packet is ready for dry-run evidence impact.",
    publicSourcePacketReady: true,
    status: "Public source packet ready",
    studies: [
      {
        id: "fixture-study-creatine-strength",
        referenceId: "fixture-ref-pubmed-42141930",
        title: "Creatine supplementation and resistance training outcomes",
        year: 2026
      }
    ]
  };
}

export function planEvidenceImpactAction({
  alreadyPromoted = false,
  forcePromote = false,
  promotionBlockers = [],
  promotionReady = false,
  status
}: EvidenceImpactPipelinePlanInput): EvidenceImpactPipelineAction {
  const base = basePipelineAction(status);

  if (alreadyPromoted && !forcePromote) {
    return {
      ...base,
      blockers: [],
      kind: "already-promoted",
      reason:
        "A previous promotion audit event already recorded this source candidate's evidence-map impact.",
      status: "skipped"
    };
  }

  if (status.status === "Claim link missing") {
    const blockers = [
      ...(status.candidate.claimId ? [] : ["candidate claim id"]),
      ...(status.acceptedReferenceId ? [] : ["accepted reference id"]),
      ...(reviewStatusIsReviewed(status.candidate.reviewStatus)
        ? []
        : [
            `candidate review status is ${status.candidate.reviewStatus}; record AI or Human review before curation writes`
          ])
    ];

    if (blockers.length > 0) {
      return {
        ...base,
        blockers: blockers.map((blocker) =>
          blocker.startsWith("candidate review status") ? blocker : `Missing ${blocker}.`
        ),
        kind: "blocked",
        reason:
          "Claim-link automation needs a candidate claim, accepted reference, and reviewed candidate decision.",
        status: "blocked"
      };
    }

    return {
      ...base,
      blockers: [],
      command: "npm run evidence:apply-ready -- --write",
      kind: "claim-link",
      reason:
        "Accepted reference and candidate claim are present; the pipeline can create the missing claim-reference link.",
      status: "would-apply",
      writePreview: claimLinkWritePreview(status)
    };
  }

  if (status.status === "Extraction pending") {
    return {
      ...base,
      blockers: [
        "Structured extraction still needs source-backed sample size, population, outcomes, safety, funding/conflict, and risk-of-bias fields."
      ],
      command: `npm run ingest:sources -- --candidate-curation-draft ${safeCandidateKey(status.candidate.dedupeKey)}`,
      kind: "extraction-needed",
      reason:
        "Extraction writes are intentionally not invented by the impact pipeline; prepare verified extraction fields first.",
      status: "blocked",
      writePreview: noWritePreview(status, [
        "Prepare source-backed structured extraction fields before any write command.",
        "Do not infer sample size, population, outcomes, safety, funding/conflict, or risk-of-bias fields from title-only leads."
      ])
    };
  }

  if (status.status === "Public source packet ready") {
    if (!promotionReady) {
      return {
        ...base,
        blockers:
          promotionBlockers.length > 0
            ? promotionBlockers
            : ["Promotion assessment did not report a ready public packet."],
        command: `npm run promotion:dry-run -- ${safeCandidateKey(status.candidate.dedupeKey)}`,
        kind: "blocked",
        reason: "Public promotion readiness must pass before evidence-map impact.",
        status: "blocked"
      };
    }

    return {
      ...base,
      blockers: [],
      command: "npm run evidence:apply-ready -- --write",
      kind: "public-promotion",
      reason:
        "Accepted reference, claim link, structured extraction, and public packet readiness are complete; the pipeline can record AI-reviewed evidence-map impact.",
      status: "would-apply",
      writePreview: publicPromotionWritePreview(status)
    };
  }

  return {
    ...base,
    blockers: [status.nextAction],
    command: `npm run ingest:sources -- --candidate-curation-status ${safeCandidateKey(status.candidate.dedupeKey)}`,
    kind: "blocked",
    reason: `Curation status is ${status.status}; finish the required curation step first.`,
    status: "blocked"
  };
}

async function applyEvidenceImpactAction(
  principal: OperatorPrincipal,
  action: EvidenceImpactPipelineAction
): Promise<EvidenceImpactPipelineAction> {
  if (action.kind === "claim-link") {
    const result = await linkSourceCandidateClaimAsOperator(
      principal,
      {
        dedupeKey: action.dedupeKey,
        note: claimLinkNote(action),
        relevance: 5
      },
      WRITE_ENV
    );

    return {
      ...action,
      details: {
        claimId: result.claimLink.claimId,
        created: result.created,
        publicSourcePacketReady: result.status.publicSourcePacketReady,
        referenceId: result.acceptedReference.id,
        status: result.status.status
      },
      reason: result.created
        ? "Created the missing claim-reference link."
        : "Claim-reference link already existed when the pipeline applied it.",
      status: "applied"
    };
  }

  if (action.kind === "public-promotion") {
    const result = await promoteSourceCandidatePublicEvidenceAsOperator(
      principal,
      {
        dedupeKey: action.dedupeKey,
        promotionNote: promotionNote(action),
        reviewStatus: "AI reviewed"
      },
      WRITE_ENV
    );

    return {
      ...action,
      details: {
        claimId: result.claim.id,
        lastReviewedAt: result.claim.lastReviewedAt ?? null,
        referenceId: result.referenceId,
        reviewStatus: result.claim.reviewStatus,
        studyIds: result.studyIds
      },
      reason: "Recorded AI-reviewed public evidence-map promotion.",
      status: "applied"
    };
  }

  throw new Error(`Action ${action.kind} cannot be applied.`);
}

async function listPromotedSourceCandidateDedupeKeys(dedupeKeys: string[]) {
  if (dedupeKeys.length === 0) {
    return new Set<string>();
  }

  const rows = await prisma.operatorAuditEvent.findMany({
    select: {
      targetId: true
    },
    where: {
      action: PROMOTION_AUDIT_ACTION,
      targetId: {
        in: dedupeKeys
      },
      targetType: "SourceCandidate"
    }
  });

  return new Set(
    rows
      .map((row) => row.targetId)
      .filter((targetId): targetId is string => typeof targetId === "string")
  );
}

async function resolveImpactPipelinePrincipal(
  actorEmail?: string
): Promise<OperatorPrincipal> {
  const users: ImpactPipelineOperatorUser[] = await prisma.user.findMany({
    include: {
      operatorProfile: true
    },
    orderBy: [{ email: "asc" }],
    where: {
      ...(actorEmail ? { email: actorEmail } : {}),
      operatorProfile: {
        is: {
          role: {
            in: [OperatorRole.OWNER, OperatorRole.ADMIN]
          },
          status: OperatorStatus.ACTIVE
        }
      }
    }
  });
  const candidates = users.filter((user) => user.operatorProfile && user.email);

  if (candidates.length === 0) {
    throw new Error(
      actorEmail
        ? `No active owner/admin operator found for ${actorEmail}.`
        : "No active owner/admin operator was found. Bootstrap an operator or pass --actor-email."
    );
  }

  if (!actorEmail && candidates.length > 1) {
    const owners = candidates.filter(
      (user) => user.operatorProfile?.role === OperatorRole.OWNER
    );

    if (owners.length === 1) {
      return principalFromUser(owners[0]);
    }

    throw new Error(
      "Multiple active owner/admin operators found; rerun with --actor-email <email>."
    );
  }

  return principalFromUser(candidates[0]);
}

function principalFromUser(user: ImpactPipelineOperatorUser): OperatorPrincipal {
  if (!user.email || !user.operatorProfile) {
    throw new Error("Operator principal is missing email or profile.");
  }

  return {
    email: user.email,
    role: user.operatorProfile.role,
    status: user.operatorProfile.status,
    userId: user.id
  };
}

async function listEvidenceImpactPipelineUpstreamLeads(
  upstreamLimit: number
): Promise<EvidenceImpactPipelineUpstreamLead[]> {
  if (upstreamLimit < 1) {
    return [];
  }

  const candidates = await listSourceCandidateReviewQueue({ limit: upstreamLimit });

  return candidates
    .filter((candidate) => candidate.decision === "Pending review")
    .map((candidate) => {
      const safeKey = safeCandidateKey(candidate.dedupeKey);

      return {
        ...(candidate.claimId ? { claimId: candidate.claimId } : {}),
        command: `npm run ingest:sources -- --candidate-review-packet ${safeKey}`,
        curationStatusCommand: `npm run ingest:sources -- --candidate-curation-status ${safeKey}`,
        dedupeKey: candidate.dedupeKey,
        decision: "Pending review",
        externalId: candidate.externalId,
        ...(candidate.interventionId ? { interventionId: candidate.interventionId } : {}),
        noAutomaticCandidateDecision: true,
        noAutomaticExtractionWrite: true,
        noAutomaticPromotion: true,
        reason:
          "Pending source-candidate lead needs explicit Codex/operator review before accepted-reference, claim-link, extraction, or promotion steps.",
        referenceMatchesCommand: `npm run ingest:sources -- --candidate-reference-matches ${safeKey}`,
        reviewStatus: candidate.reviewStatus,
        source: candidate.source,
        title: candidate.title,
        triageScore: candidate.triageScore
      };
    });
}

function buildEvidenceImpactPipelineResult({
  applied,
  blocked,
  dryRun,
  principal,
  scanned,
  skipped,
  upstreamLeads,
  warnings = [],
  wouldApply
}: {
  applied: EvidenceImpactPipelineAction[];
  blocked: EvidenceImpactPipelineAction[];
  dryRun: boolean;
  principal?: OperatorPrincipal;
  scanned: number;
  skipped: EvidenceImpactPipelineAction[];
  upstreamLeads: EvidenceImpactPipelineUpstreamLead[];
  warnings?: string[];
  wouldApply: EvidenceImpactPipelineAction[];
}): EvidenceImpactPipelineResult {
  return {
    applied,
    blocked,
    dryRun,
    principal: principal
      ? {
          email: principal.email,
          role: principal.role,
          userId: principal.userId
        }
      : undefined,
    scanned,
    skipped,
    summary: {
      applied: applied.length,
      blocked: blocked.length,
      scanned,
      skipped: skipped.length,
      upstreamLeads: upstreamLeads.length,
      wouldApply: wouldApply.length
    },
    upstreamLeads,
    warnings,
    wouldApply
  };
}

function isDatabaseConnectionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes("Can't reach database server") ||
    message.includes("P1001") ||
    message.includes("ECONNREFUSED")
  );
}

function basePipelineAction(
  status: SourceCandidateCurationStatus
): Omit<EvidenceImpactPipelineAction, "blockers" | "kind" | "reason" | "status"> {
  return {
    claimId: status.candidate.claimId,
    dedupeKey: status.candidate.dedupeKey,
    externalId: status.candidate.externalId,
    source: status.candidate.source,
    title: status.candidate.title,
    writePreview: noWritePreview(status)
  };
}

function claimLinkWritePreview(
  status: SourceCandidateCurationStatus
): EvidenceImpactPipelineWritePreview {
  const safeKey = safeCandidateKey(status.candidate.dedupeKey);
  const writeScope = [
    "ClaimReference upsert for the accepted reference and candidate claim",
    "operator audit event for sourceCandidate.claimLink"
  ];

  return {
    approvalRequest: evidenceImpactApprovalRequest({
      actionKind: "claim-link",
      command: 'npm run evidence:apply-ready -- --write --actor-email "<operator-email>"',
      requiredInputs: [
        "--write",
        "--actor-email",
        "acceptedReferenceId",
        "claimId",
        "candidate reviewStatus"
      ],
      requiredOperatorPermissions: ["curation:claim-link"],
      status,
      stopConditions: [
        "User/operator does not explicitly approve this local evidence-impact claim-link write.",
        "Candidate decision is not Accepted or reviewStatus is not AI reviewed/Human reviewed.",
        "Accepted reference no longer matches the candidate source and external id.",
        "Candidate claimId is missing or no longer belongs to the expected intervention.",
        "The curation status changed since the dry-run packet was reviewed."
      ],
      writeScope
    }),
    commandCopy: [
      "npm run evidence:apply-ready -- --json",
      'npm run evidence:apply-ready -- --write --actor-email "<operator-email>"',
      `npm run ingest:sources -- --candidate-curation-status ${safeKey}`
    ],
    preWriteChecks: [
      "candidate decision is Accepted and review status is AI reviewed or Human reviewed",
      "accepted reference matches the candidate source and external id",
      "candidate claim exists and belongs to the candidate intervention when an intervention is present"
    ],
    rollbackNotes: [
      "If the link was newly created in error, remove the ClaimReference only through an approved audited rollback.",
      "If an existing link was updated, restore the previous note and relevance from the pre-write evidence packet."
    ],
    transactionality: "operator-action",
    verification: [
      `rerun candidate curation status for ${safeKey}`,
      "confirm the ClaimReference row links the accepted reference to the candidate claim",
      "confirm an operator audit event records sourceCandidate.claimLink"
    ],
    writeScope
  };
}

function publicPromotionWritePreview(
  status: SourceCandidateCurationStatus
): EvidenceImpactPipelineWritePreview {
  const safeKey = safeCandidateKey(status.candidate.dedupeKey);
  const writeScope = [
    "Claim review status and lastReviewedAt update",
    "ReviewEvent create",
    "ClaimScoreSnapshot create",
    "ClaimScoreHistory create",
    "PublicChangelogEntry create with publishedAt null",
    "operator audit event for sourceCandidate.publicEvidencePromotion"
  ];

  return {
    approvalRequest: evidenceImpactApprovalRequest({
      actionKind: "public-promotion",
      command: 'npm run evidence:apply-ready -- --write --actor-email "<operator-email>"',
      requiredInputs: [
        "--write",
        "--actor-email",
        "promotion dry-run ready packet",
        "reviewStatus=AI reviewed"
      ],
      requiredOperatorPermissions: ["evidence:promote"],
      status,
      stopConditions: [
        "User/operator does not explicitly approve this local evidence-impact promotion write.",
        "Promotion dry-run no longer reports a ready public source packet.",
        "Accepted reference, claim link, or structured extraction is missing.",
        "Requested reviewStatus is Human reviewed without explicit human confirmation.",
        "Citation traceability, uncertainty labels, AU/TGA caveats, or product-level evidence boundaries changed since review."
      ],
      writeScope
    }),
    commandCopy: [
      `npm run promotion:dry-run -- ${safeKey}`,
      "npm run evidence:apply-ready -- --json",
      'npm run evidence:apply-ready -- --write --actor-email "<operator-email>"'
    ],
    preWriteChecks: [
      "promotion dry-run reports a ready public source packet",
      "accepted reference, candidate claim link, and structured extraction are present",
      "review status remains AI reviewed unless a human explicitly confirms Human reviewed"
    ],
    rollbackNotes: [
      "Restore claim review status and lastReviewedAt only through an approved audited rollback.",
      "Leave generated review, score, changelog, and audit records traceable; publish a correcting changelog rather than deleting history."
    ],
    transactionality: "single-transaction",
    verification: [
      "claim review status and lastReviewedAt changed together",
      "review event, score snapshot, score history, unpublished changelog entry, and operator audit event were created",
      "public changelog remains unpublished until a separate publication approval"
    ],
    writeScope
  };
}

function noWritePreview(
  status: SourceCandidateCurationStatus,
  preWriteChecks: string[] = ["Resolve blockers before any write command."]
): EvidenceImpactPipelineWritePreview {
  const safeKey = safeCandidateKey(status.candidate.dedupeKey);

  return {
    commandCopy: [
      `npm run ingest:sources -- --candidate-curation-status ${safeKey}`
    ],
    preWriteChecks,
    rollbackNotes: ["No rollback is needed for the dry-run preview because it writes nothing."],
    transactionality: "no-write",
    verification: [`rerun candidate curation status for ${safeKey}`],
    writeScope: []
  };
}

function evidenceImpactApprovalRequest({
  actionKind,
  command,
  requiredInputs,
  requiredOperatorPermissions,
  status,
  stopConditions,
  writeScope
}: {
  actionKind: "claim-link" | "public-promotion";
  command: string;
  requiredInputs: string[];
  requiredOperatorPermissions: OperatorPermission[];
  status: SourceCandidateCurationStatus;
  stopConditions: string[];
  writeScope: string[];
}): EvidenceImpactPipelineApprovalRequest {
  const claimId = status.candidate.claimId;
  const referenceId = status.acceptedReferenceId;
  const target = [
    status.candidate.dedupeKey,
    claimId ? `for claim ${claimId}` : undefined,
    referenceId ? `and reference ${referenceId}` : undefined
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");

  return {
    approvalDecision: "required-before-write-command",
    approvalPhrase: `Approve local evidence-impact ${actionKind} apply for ${target}.`,
    approvalScope: writeScope,
    command,
    noDatabaseWrite: true,
    noPublicEvidenceRowsWritten: true,
    requiredInputs,
    requiredOperatorPermissions,
    status: "approval-required",
    stopConditions,
    target: {
      ...(claimId ? { claimId } : {}),
      dedupeKey: status.candidate.dedupeKey,
      externalId: status.candidate.externalId,
      ...(referenceId ? { referenceId } : {}),
      reviewStatus: "AI reviewed",
      source: status.candidate.source
    },
    writes: "none"
  };
}

function claimLinkNote(action: EvidenceImpactPipelineAction) {
  return [
    `AI-reviewed impact pipeline claim link for accepted ${action.source} candidate ${action.externalId}.`,
    `Links the traceable accepted reference to candidate claim ${action.claimId}.`,
    "No study extraction, score recalculation, public publication, product-level AU/TGA inference, or individualized medical advice is performed by this claim-link step."
  ].join(" ");
}

function promotionNote(action: EvidenceImpactPipelineAction) {
  return [
    `AI-reviewed impact pipeline promotion for accepted ${action.source} candidate ${action.externalId}.`,
    "Readiness confirmed a traceable accepted reference, candidate claim link, structured extraction, and publicSourcePacketReady=true.",
    "Records the claim packet as AI reviewed using existing score fields and preserves uncertainty labels, AU/TGA caveats, product-level evidence boundaries, and no individualized medical advice or prohibited sourcing/dosing guidance."
  ].join(" ");
}

function safeCandidateKey(dedupeKey: string) {
  return /^[A-Za-z0-9._:-]+$/.test(dedupeKey)
    ? dedupeKey
    : `b64:${Buffer.from(dedupeKey, "utf8").toString("base64url")}`;
}

function reviewStatusIsReviewed(
  reviewStatus: SourceCandidateCurationStatus["candidate"]["reviewStatus"]
) {
  return reviewStatus === "AI reviewed" || reviewStatus === "Human reviewed";
}
