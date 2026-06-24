import { buildClaimSourcePacket } from "@/lib/source-packet";
import type {
  Claim,
  EvidenceDashboardData,
  Intervention,
  Reference,
  Study
} from "@/lib/types";
import type { SupplementOnboardingSourceSignals } from "@/lib/supplement-onboarding-readiness";
import {
  getSourceConvictionRubric,
  type SourceConvictionRubric,
  SourceConvictionScoreBreakdown,
  SourceCandidateTriageRecommendation,
  SourceReputationLabel
} from "@/lib/source-conviction";

export interface SupplementOnboardingReviewPacket {
  caveats: string[];
  claim: {
    claimText: string;
    confidenceLevel: string;
    finalLabel: string;
    id: string;
    outcome: string;
    reviewStatus: string;
    whatWouldChangeScore: string;
  };
  curatedSources: Array<{
    extractionStatus: "extracted" | "pending";
    reference: Reference;
    studies: Array<Pick<
      Study,
      | "adverseEvents"
      | "fundingConflicts"
      | "id"
      | "intervention"
      | "outcomes"
      | "population"
      | "referenceId"
      | "riskOfBias"
      | "sampleSize"
      | "studyType"
      | "title"
      | "year"
    >>;
  }>;
  generatedAt: string;
  missingReferenceIds: string[];
  operatorDecision: {
    candidateCounts: {
      accepted: number;
      bestFirst: number;
      holdOrReject: number;
      lowerConvictionOrRejected: number;
      limitationsOnly: number;
      pendingReview: number;
      reviewAfterStrongerSources: number;
      reviewFirst: number;
    };
    label: string;
    nextActions: string[];
    noAutoDecision: true;
    rationale: string[];
    readOnly: true;
    recommendation:
      | "ready-for-human-review"
      | "needs-more-evidence"
      | "hold-or-reject";
    summary: string;
  };
  candidateReviewAutopilot: {
    curationDraftCommand?: string;
    humanOwned: true;
    nextAction: string;
    noAutoAccept: true;
    noAutoExtraction: true;
    noAutoPromotion: true;
    noAutoReject: true;
    rationale: string[];
    readOnly: true;
    recommendedCandidate?: {
      decision: string;
      dedupeKey?: string;
      externalId?: string;
      limitations: string[];
      positiveFactors: string[];
      rubricVersion?: string;
      score?: number;
      scoreBreakdown?: SourceConvictionScoreBreakdown;
      source?: string;
      sourceReputationLabel?: SourceReputationLabel;
      title?: string;
      triageRationale: string[];
      triageRecommendation?: SourceCandidateTriageRecommendation;
    };
    status:
      | "review-pending-candidate"
      | "summarize-limitations"
      | "ready-no-pending-candidates"
      | "blocked-by-safety";
  };
  pendingReferenceIds: string[];
  proposedPublicWording: {
    citationTraceability: string;
    evidenceSummary: string;
    regulatoryCaveat: string;
    safetyCaveat: string;
    status: "review-required";
    uncertaintyLabel: string;
  };
  promotionDiff: {
    auditMetadata: {
      noAutoPromotion: true;
      operatorPermission: "evidence:promote";
      targetId: string;
      targetType: "Claim";
      requiredAction: string;
    };
    blockers: string[];
    dashboardCards: {
      citationCount: number;
      confidenceLevel: string;
      evidenceLabel: string;
      extractionStatus: string;
      safetyNotes: string;
    };
    publicClaimText: {
      changes: boolean;
      current: string;
      proposed: string;
    };
    readOnly: true;
    readyForPromotionReview: boolean;
    referenceLinks: {
      addedReferenceIds: string[];
      currentReferenceIds: string[];
      proposedReferenceIds: string[];
      removedReferenceIds: string[];
    };
    scoreChanges: Array<{
      changes: boolean;
      current: number;
      metric: string;
      proposed: number;
    }>;
    uncertaintyLabels: {
      confidenceLevel: {
        changes: boolean;
        current: string;
        proposed: string;
      };
      reviewStatus: {
        changes: boolean;
        current: string;
        proposed: "Human reviewed";
      };
    };
  };
  readOnly: true;
  safetyWatchlist: {
    acceptedPacketSignals: Array<{
      matchedTerms: string[];
      referenceId: string;
      requiredAction: string;
      severity: "blocked" | "warning";
      signalId: string;
      signalLabel: string;
      sourceField: string;
      studyId: string;
      studyTitle: string;
    }>;
    nextAction: string;
  };
  sourceCandidates: {
    accepted: ReviewPacketCandidate[];
    bestFirst: ReviewPacketCandidate[];
    lowerConvictionOrRejected: ReviewPacketCandidate[];
    pendingReview: ReviewPacketCandidate[];
  };
  sourcePacket: {
    detail: string;
    label: string;
    nextStep: string;
    status: string;
    totalReferences: number;
  };
  supplement: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface SupplementOnboardingReviewPacketReport {
  generatedAt: string;
  packets: SupplementOnboardingReviewPacket[];
  readOnly: true;
  sourceConvictionRubric: SourceConvictionRubric;
  unmatchedClaimId?: string;
  unmatchedSupplementQuery?: string;
}

interface ReviewPacketCandidate {
  acceptedReferenceId?: string;
  decision: string;
  dedupeKey?: string;
  externalId?: string;
  limitations: string[];
  positiveFactors: string[];
  reviewStatus: string;
  rubricVersion?: string;
  score?: number;
  scoreBreakdown?: SourceConvictionScoreBreakdown;
  source?: string;
  sourceReputationLabel?: SourceReputationLabel;
  title?: string;
  triageRationale: string[];
  triageRecommendation?: SourceCandidateTriageRecommendation;
  uncertainty?: string;
}

const ACCEPTED_PACKET_SAFETY_RULES = [
  {
    id: "adverse-event-context",
    label: "Adverse-event or tolerability context",
    requiredAction:
      "Keep adverse-event and tolerability caveats visible until the structured source packet is reviewed.",
    severity: "warning",
    terms: ["adverse event", "adverse events", "side effect", "side effects", "tolerability"]
  },
  {
    id: "bleeding-anticoagulant-context",
    label: "Bleeding or anticoagulant context",
    requiredAction:
      "Retain bleeding/anticoagulant caveats as source-backed safety context; avoid individualized advice.",
    severity: "warning",
    terms: ["bleeding", "anticoagulant", "blood thinner", "warfarin"]
  },
  {
    id: "cardiac-rhythm-context",
    label: "Cardiac rhythm context",
    requiredAction:
      "Retain arrhythmia/atrial-fibrillation caveats when relevant and keep uncertainty visible.",
    severity: "warning",
    terms: ["atrial fibrillation", "arrhythmia"]
  },
  {
    id: "organ-risk-context",
    label: "Organ-risk context",
    requiredAction:
      "Retain liver/kidney safety caveats and require source-backed wording before public promotion.",
    severity: "warning",
    terms: ["liver injury", "hepatotoxicity", "kidney", "renal"]
  },
  {
    id: "peptide-administration-context",
    label: "Peptide, injection, or preparation context",
    requiredAction:
      "Block public sourcing, compounding, reconstitution, injection, cycling, or self-administration guidance.",
    severity: "blocked",
    terms: ["peptide", "injectable", "injection", "vial", "compounding", "reconstitution", "cycle", "cycling"]
  },
  {
    id: "regulatory-safety-context",
    label: "Regulatory safety context",
    requiredAction:
      "Keep AU/TGA/regulatory status explicit and product-level; do not infer clearance from ingredient evidence.",
    severity: "warning",
    terms: ["unapproved", "prescription", "controlled", "banned", "not in artg"]
  }
] as const satisfies Array<{
  id: string;
  label: string;
  requiredAction: string;
  severity: "blocked" | "warning";
  terms: string[];
}>;

export function buildSupplementOnboardingReviewPacketReport({
  claimId,
  data,
  generatedAt = new Date(),
  sourceSignals,
  supplementQuery
}: {
  claimId?: string;
  data: EvidenceDashboardData;
  generatedAt?: Date;
  sourceSignals?: SupplementOnboardingSourceSignals;
  supplementQuery?: string;
}): SupplementOnboardingReviewPacketReport {
  const supplement = supplementQuery
    ? findIntervention(data.interventions, supplementQuery)
    : undefined;
  const claims = claimsForReviewPacket({
    claimId,
    claims: data.claims,
    supplementId: supplement?.id
  });
  const referencesById = new Map(
    data.references.map((reference) => [reference.id, reference])
  );
  const generatedAtIso = generatedAt.toISOString();

  return {
    generatedAt: generatedAtIso,
    packets: claims
      .map((claim) => {
        const claimSupplement =
          supplement ??
          data.interventions.find(
            (intervention) => intervention.id === claim.interventionId
          );

        if (!claimSupplement) {
          return undefined;
        }

        return buildSupplementOnboardingReviewPacket({
          claim,
          data,
          generatedAt: generatedAtIso,
          referencesById,
          sourceSignals,
          supplement: claimSupplement
        });
      })
      .filter((packet): packet is SupplementOnboardingReviewPacket =>
        Boolean(packet)
      ),
    readOnly: true,
    unmatchedClaimId:
      claimId && !data.claims.some((claim) => claim.id === claimId)
        ? claimId
        : undefined,
    sourceConvictionRubric: getSourceConvictionRubric(),
    unmatchedSupplementQuery:
      supplementQuery && !supplement ? supplementQuery : undefined
  };
}

function buildSupplementOnboardingReviewPacket({
  claim,
  data,
  generatedAt,
  referencesById,
  sourceSignals,
  supplement
}: {
  claim: Claim;
  data: EvidenceDashboardData;
  generatedAt: string;
  referencesById: Map<string, Reference>;
  sourceSignals?: SupplementOnboardingSourceSignals;
  supplement: Intervention;
}): SupplementOnboardingReviewPacket {
  const sourcePacket = buildClaimSourcePacket({
    claim,
    referencesById,
    studies: data.studies
  });
  const candidates = reviewPacketCandidates(sourceSignals, claim, supplement.id);
  const regulatoryStatuses = data.australiaRegulatoryStatuses.filter(
    (status) =>
      status.interventionId === supplement.id ||
      sourcePacket.references.some((reference) => reference.id === status.referenceId)
  );
  const safetyWatchlist = sourcePacketSafetyWatchlist(sourcePacket);
  const packetPromotionDiff = promotionDiff({
    claim,
    sourcePacket
  });
  const sourceCandidates = {
    accepted: candidates.filter((candidate) => candidate.decision === "ACCEPTED"),
    bestFirst: candidates.slice(0, 5),
    lowerConvictionOrRejected: candidates.filter(
      (candidate) =>
        candidate.decision === "REJECTED" ||
        (typeof candidate.score === "number" && candidate.score < 55) ||
        candidate.triageRecommendation === "limitations-only" ||
        candidate.triageRecommendation === "hold-or-reject"
    ),
    pendingReview: candidates.filter(
      (candidate) => candidate.decision === "PENDING_REVIEW"
    )
  };

  return {
    caveats: packetCaveats({
      candidates,
      claim,
      regulatoryStatuses,
      safetyWatchlist,
      sourcePacket
    }),
    claim: {
      claimText: claim.claimText,
      confidenceLevel: claim.confidenceLevel,
      finalLabel: claim.finalLabel,
      id: claim.id,
      outcome: claim.outcome,
      reviewStatus: claim.reviewStatus,
      whatWouldChangeScore: claim.whatWouldChangeScore
    },
    curatedSources: sourcePacket.references.map((reference) => {
      const studies = sourcePacket.studies.filter(
        (study) => study.referenceId === reference.id
      );

      return {
        extractionStatus: studies.length > 0 ? "extracted" : "pending",
        reference,
        studies: studies.map(reviewPacketStudy)
      };
    }),
    generatedAt,
    missingReferenceIds: sourcePacket.missingReferenceIds,
    operatorDecision: operatorDecisionSupport({
      promotionDiff: packetPromotionDiff,
      safetyWatchlist,
      sourceCandidates,
      sourcePacket
    }),
    candidateReviewAutopilot: candidateReviewAutopilot({
      safetyWatchlist,
      sourceCandidates
    }),
    pendingReferenceIds: sourcePacket.pendingReferences.map(
      (reference) => reference.id
    ),
    proposedPublicWording: proposedPublicWording({
      claim,
      regulatoryStatuses,
      sourcePacket
    }),
    promotionDiff: packetPromotionDiff,
    readOnly: true,
    safetyWatchlist,
    sourceCandidates,
    sourcePacket: {
      detail: sourcePacket.completeness.detail,
      label: sourcePacket.completeness.label,
      nextStep: sourcePacket.completeness.nextStep,
      status: sourcePacket.completeness.status,
      totalReferences: sourcePacket.completeness.totalReferences
    },
    supplement: {
      id: supplement.id,
      name: supplement.name,
      slug: supplement.slug
    }
  };
}

function candidateReviewAutopilot({
  safetyWatchlist,
  sourceCandidates
}: {
  safetyWatchlist: SupplementOnboardingReviewPacket["safetyWatchlist"];
  sourceCandidates: SupplementOnboardingReviewPacket["sourceCandidates"];
}): SupplementOnboardingReviewPacket["candidateReviewAutopilot"] {
  const blockedSafetySignals = safetyWatchlist.acceptedPacketSignals.filter(
    (signal) => signal.severity === "blocked"
  ).length;

  if (blockedSafetySignals > 0) {
    return {
      humanOwned: true,
      nextAction:
        "Resolve blocked safety/watchlist context before changing source-candidate decisions.",
      noAutoAccept: true,
      noAutoExtraction: true,
      noAutoPromotion: true,
      noAutoReject: true,
      rationale: [
        `${blockedSafetySignals} blocked accepted-packet safety/watchlist signal(s) were detected.`,
        "Safety and regulatory blockers outrank source-conviction ranking."
      ],
      readOnly: true,
      status: "blocked-by-safety"
    };
  }

  const pendingCandidate = sourceCandidates.pendingReview[0];

  if (pendingCandidate) {
    return {
      curationDraftCommand: pendingCandidate.dedupeKey
        ? `npm run ingest:sources -- --candidate-curation-draft ${quote(pendingCandidate.dedupeKey)}`
        : undefined,
      humanOwned: true,
      nextAction:
        "Open the recommended candidate curation draft, then explicitly accept or reject it after source review.",
      noAutoAccept: true,
      noAutoExtraction: true,
      noAutoPromotion: true,
      noAutoReject: true,
      rationale: candidateAutopilotRationale(pendingCandidate),
      readOnly: true,
      recommendedCandidate: candidateAutopilotCandidate(pendingCandidate),
      status: "review-pending-candidate"
    };
  }

  const limitationCandidate = sourceCandidates.lowerConvictionOrRejected[0];

  if (limitationCandidate) {
    return {
      humanOwned: true,
      nextAction:
        "Summarize lower-conviction or rejected candidates as limitations; do not use them as support by themselves.",
      noAutoAccept: true,
      noAutoExtraction: true,
      noAutoPromotion: true,
      noAutoReject: true,
      rationale: candidateAutopilotRationale(limitationCandidate),
      readOnly: true,
      recommendedCandidate: candidateAutopilotCandidate(limitationCandidate),
      status: "summarize-limitations"
    };
  }

  return {
    humanOwned: true,
    nextAction:
      "No pending or limitation-first candidates remain; continue with explicit packet review and separate promotion diff review.",
    noAutoAccept: true,
    noAutoExtraction: true,
    noAutoPromotion: true,
    noAutoReject: true,
    rationale: [
      "No pending source candidates remain in this claim packet.",
      "Candidate review autopilot is decision support only; public evidence changes still require audited operator actions."
    ],
    readOnly: true,
    status: "ready-no-pending-candidates"
  };
}

function candidateAutopilotCandidate(candidate: ReviewPacketCandidate) {
  return {
    decision: candidate.decision,
    dedupeKey: candidate.dedupeKey,
    externalId: candidate.externalId,
    limitations: candidate.limitations,
    positiveFactors: candidate.positiveFactors,
    rubricVersion: candidate.rubricVersion,
    score: candidate.score,
    scoreBreakdown: candidate.scoreBreakdown,
    source: candidate.source,
    sourceReputationLabel: candidate.sourceReputationLabel,
    title: candidate.title,
    triageRationale: candidate.triageRationale,
    triageRecommendation: candidate.triageRecommendation
  };
}

function candidateAutopilotRationale(candidate: ReviewPacketCandidate) {
  return uniqueNonEmpty([
    candidate.score !== undefined
      ? `Source conviction ${candidate.score}/100.`
      : "Source conviction score is unavailable.",
    ...(candidate.sourceReputationLabel
      ? [`Source reputation: ${candidate.sourceReputationLabel}.`]
      : []),
    ...(candidate.scoreBreakdown
      ? [
          `Score breakdown: reputation ${candidate.scoreBreakdown.sourceReputation}, study design ${candidate.scoreBreakdown.studyDesign}, traceability ${candidate.scoreBreakdown.traceability}, recency ${candidate.scoreBreakdown.recency}, abstract ${candidate.scoreBreakdown.abstractAvailability}, triage ${candidate.scoreBreakdown.triageSignal}, relevance penalty ${candidate.scoreBreakdown.titleQueryOverlapPenalty}.`
        ]
      : []),
    ...(candidate.rubricVersion
      ? [`Rubric version: ${candidate.rubricVersion}.`]
      : []),
    ...(candidate.triageRecommendation
      ? [`Triage recommendation: ${candidate.triageRecommendation}.`]
      : []),
    ...candidate.triageRationale.slice(0, 2),
    ...candidate.positiveFactors.slice(0, 2),
    ...candidate.limitations.slice(0, 2)
  ]);
}

function operatorDecisionSupport({
  promotionDiff,
  safetyWatchlist,
  sourceCandidates,
  sourcePacket
}: {
  promotionDiff: SupplementOnboardingReviewPacket["promotionDiff"];
  safetyWatchlist: SupplementOnboardingReviewPacket["safetyWatchlist"];
  sourceCandidates: SupplementOnboardingReviewPacket["sourceCandidates"];
  sourcePacket: ReturnType<typeof buildClaimSourcePacket>;
}): SupplementOnboardingReviewPacket["operatorDecision"] {
  const blockedSafetySignals = safetyWatchlist.acceptedPacketSignals.filter(
    (signal) => signal.severity === "blocked"
  ).length;
  const countedCandidates = uniqueReviewPacketCandidates([
    ...sourceCandidates.accepted,
    ...sourceCandidates.bestFirst,
    ...sourceCandidates.lowerConvictionOrRejected,
    ...sourceCandidates.pendingReview
  ]);
  const candidateCounts = {
    accepted: sourceCandidates.accepted.length,
    bestFirst: sourceCandidates.bestFirst.length,
    holdOrReject: countCandidatesByTriage(countedCandidates, "hold-or-reject"),
    lowerConvictionOrRejected: sourceCandidates.lowerConvictionOrRejected.length,
    limitationsOnly: countCandidatesByTriage(countedCandidates, "limitations-only"),
    pendingReview: sourceCandidates.pendingReview.length,
    reviewAfterStrongerSources: countCandidatesByTriage(
      countedCandidates,
      "review-after-stronger-sources"
    ),
    reviewFirst: countCandidatesByTriage(countedCandidates, "review-first")
  };

  if (blockedSafetySignals > 0) {
    return {
      candidateCounts,
      label: "Hold / reject until blocked safety context is resolved",
      nextActions: [
        "Review blocked safety/watchlist signals before public wording or promotion.",
        "Reject or exclude candidates that only support sourcing, preparation, or self-administration context.",
        "Keep peptide/regulatory caveats visible and do not add self-use guidance."
      ],
      noAutoDecision: true,
      rationale: [
        `${blockedSafetySignals} blocked accepted-packet safety/watchlist signal(s) were detected.`,
        "Blocked safety context outranks candidate conviction for public onboarding."
      ],
      readOnly: true,
      recommendation: "hold-or-reject",
      summary:
        "Do not treat this packet as ready. Resolve blocked safety/regulatory context before accepting support or promoting public evidence."
    };
  }

  if (promotionDiff.blockers.length > 0 || sourcePacket.completeness.status !== "complete") {
    return {
      candidateCounts,
      label: "Needs more evidence",
      nextActions: [
        "Complete curated reference links and structured extraction before human packet review.",
        "Use the best-first candidate list to find stronger claim-scoped sources.",
        "Keep promotion blocked until citation traceability and extraction are complete."
      ],
      noAutoDecision: true,
      rationale: [
        ...promotionDiff.blockers,
        sourcePacket.completeness.detail
      ],
      readOnly: true,
      recommendation: "needs-more-evidence",
      summary:
        "The packet is not ready for human review or promotion because evidence links, extraction, or review gates remain incomplete."
    };
  }

  if (sourceCandidates.pendingReview.length > 0) {
    return {
      candidateCounts,
      label: "Needs candidate review",
      nextActions: [
        "Review pending source candidates and record explicit accept/reject decisions.",
        "Summarize rejected or lower-conviction candidates as limitations.",
        "Rebuild the review packet after candidate decisions are updated."
      ],
      noAutoDecision: true,
      rationale: [
        `${sourceCandidates.pendingReview.length} pending source candidate(s) remain.`,
        "Pending candidates can change source support, limitations, or uncertainty wording."
      ],
      readOnly: true,
      recommendation: "needs-more-evidence",
      summary:
        "The curated packet is structurally complete, but pending candidates should be reviewed before final human packet sign-off."
    };
  }

  if (
    sourceCandidates.accepted.length === 0 &&
    sourceCandidates.lowerConvictionOrRejected.length > 0
  ) {
    return {
      candidateCounts,
      label: "Hold / likely reject unsupported packet",
      nextActions: [
        "Do not promote the claim from lower-conviction or rejected candidates alone.",
        "Queue or review stronger claim-scoped sources before accepting support.",
        "Keep lower-conviction or rejected candidates in the limitations section."
      ],
      noAutoDecision: true,
      rationale: [
        "No accepted candidate is visible for this claim packet.",
        `${sourceCandidates.lowerConvictionOrRejected.length} lower-conviction or rejected candidate(s) should be treated as limitations.`
      ],
      readOnly: true,
      recommendation: "hold-or-reject",
      summary:
        "The visible candidate set does not support accepting the packet yet; hold or reject support until stronger reviewed evidence exists."
    };
  }

  return {
    candidateCounts,
    label: "Ready for human packet review",
    nextActions: [
      "Verify citation traceability, uncertainty labels, safety caveats, and AU/TGA wording.",
      "Mark the packet human-reviewed only through the explicit operator review action.",
      "Review promotion diffs separately before any public promotion."
    ],
    noAutoDecision: true,
    rationale: [
      "Curated references and structured extraction are complete.",
      "No pending source candidates remain in this packet.",
      `${sourceCandidates.accepted.length} accepted candidate(s) and ${sourcePacket.references.length} curated reference(s) are visible.`
    ],
    readOnly: true,
    recommendation: "ready-for-human-review",
    summary:
      "The packet is ready for explicit human packet review, with promotion still handled as a separate audited step."
  };
}

function claimsForReviewPacket({
  claimId,
  claims,
  supplementId
}: {
  claimId?: string;
  claims: Claim[];
  supplementId?: string;
}) {
  if (claimId) {
    return claims.filter((claim) => claim.id === claimId);
  }

  if (supplementId) {
    return claims.filter((claim) => claim.interventionId === supplementId);
  }

  return [];
}

function reviewPacketCandidates(
  sourceSignals: SupplementOnboardingSourceSignals | undefined,
  claim: Claim,
  supplementId: string
): ReviewPacketCandidate[] {
  return (sourceSignals?.candidates ?? [])
    .filter(
      (candidate) =>
        candidate.claimId === claim.id ||
        (!candidate.claimId && candidate.interventionId === supplementId) ||
        (candidate.acceptedReferenceId
          ? claim.keyReferenceIds.includes(candidate.acceptedReferenceId)
          : false)
    )
    .map((candidate) => ({
      acceptedReferenceId: candidate.acceptedReferenceId,
      decision: normalizeDecision(candidate.decision),
      dedupeKey: candidate.dedupeKey,
      externalId: candidate.externalId,
      limitations: candidate.convictionLimitations ?? [],
      positiveFactors: candidate.convictionPositiveFactors ?? [],
      reviewStatus: candidate.reviewStatus,
      rubricVersion: candidate.convictionRubricVersion,
      score: candidate.convictionScore,
      scoreBreakdown: candidate.convictionScoreBreakdown,
      source: candidate.source,
      sourceReputationLabel: candidate.sourceReputationLabel,
      title: candidate.title,
      triageRationale: candidate.triageRationale ?? [],
      triageRecommendation: candidate.triageRecommendation,
      uncertainty: candidate.convictionUncertainty
    }))
    .sort(compareReviewPacketCandidates);
}

function compareReviewPacketCandidates(
  left: ReviewPacketCandidate,
  right: ReviewPacketCandidate
) {
  return (
    decisionRank(right.decision) - decisionRank(left.decision) ||
    triageRank(right.triageRecommendation) - triageRank(left.triageRecommendation) ||
    (right.score ?? -1) - (left.score ?? -1) ||
    (left.title ?? "").localeCompare(right.title ?? "")
  );
}

function decisionRank(decision: string) {
  const normalized = normalizeDecision(decision);

  if (normalized === "ACCEPTED") {
    return 2;
  }

  if (normalized === "PENDING_REVIEW") {
    return 1;
  }

  return 0;
}

function triageRank(recommendation?: SourceCandidateTriageRecommendation) {
  if (recommendation === "review-first") {
    return 4;
  }

  if (recommendation === "review-after-stronger-sources") {
    return 3;
  }

  if (recommendation === "limitations-only") {
    return 2;
  }

  if (recommendation === "hold-or-reject") {
    return 1;
  }

  return 0;
}

function countCandidatesByTriage(
  candidates: ReviewPacketCandidate[],
  recommendation: SourceCandidateTriageRecommendation
) {
  return candidates.filter(
    (candidate) => candidate.triageRecommendation === recommendation
  ).length;
}

function uniqueReviewPacketCandidates(candidates: ReviewPacketCandidate[]) {
  const seen = new Set<string>();
  const unique: ReviewPacketCandidate[] = [];

  for (const candidate of candidates) {
    const key = [
      candidate.dedupeKey,
      candidate.source,
      candidate.externalId,
      candidate.title,
      candidate.decision
    ]
      .map((value) => value?.trim().toLowerCase() ?? "")
      .join("|");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(candidate);
  }

  return unique;
}

function normalizeDecision(decision: string) {
  const normalized = decision.trim().toUpperCase().replace(/\s+/g, "_");

  if (normalized === "ACCEPTED") {
    return "ACCEPTED";
  }

  if (normalized === "REJECTED") {
    return "REJECTED";
  }

  return "PENDING_REVIEW";
}

function quote(value: string) {
  return JSON.stringify(value);
}

function packetCaveats({
  candidates,
  claim,
  regulatoryStatuses,
  safetyWatchlist,
  sourcePacket
}: {
  candidates: ReviewPacketCandidate[];
  claim: Claim;
  regulatoryStatuses: EvidenceDashboardData["australiaRegulatoryStatuses"];
  safetyWatchlist: SupplementOnboardingReviewPacket["safetyWatchlist"];
  sourcePacket: ReturnType<typeof buildClaimSourcePacket>;
}) {
  const caveats = [
    claim.safetyNotes,
    claim.applicabilityNotes,
    sourcePacket.completeness.nextStep
  ];

  if (!reviewStatusIsReviewed(claim.reviewStatus)) {
    caveats.push("Claim packet is not reviewed; do not promote public wording.");
  }

  if (regulatoryStatuses.length === 0 || regulatoryStatuses.some((status) => status.kind === "Unknown")) {
    caveats.push(
      "AU/TGA product-level status is unknown or unverified; do not infer product authorisation."
    );
  }

  if (candidates.some((candidate) => candidate.decision === "PENDING_REVIEW")) {
    caveats.push("Unreviewed source candidates remain; inspect best-first candidates before promotion.");
  }

  if (
    candidates.some(
      (candidate) => typeof candidate.score === "number" && candidate.score < 55
    )
  ) {
    caveats.push("Lower-conviction candidates should be summarized as limitations, not support.");
  }

  if (safetyWatchlist.acceptedPacketSignals.length > 0) {
    caveats.push(
      "Accepted source packet contains safety/watchlist terms; keep safety caveats visible."
    );
  }

  return uniqueNonEmpty(caveats);
}

function sourcePacketSafetyWatchlist(
  sourcePacket: ReturnType<typeof buildClaimSourcePacket>
): SupplementOnboardingReviewPacket["safetyWatchlist"] {
  const acceptedPacketSignals = sourcePacket.studies.flatMap((study) =>
    safetySignalsForStudy(study)
  );

  return {
    acceptedPacketSignals,
    nextAction:
      acceptedPacketSignals.length > 0
        ? "Review accepted-packet safety signals before changing public caveats or promotion wording."
        : "No accepted-packet safety/watchlist terms were detected; retain baseline safety caveats."
  };
}

function safetySignalsForStudy(
  study: ReturnType<typeof buildClaimSourcePacket>["studies"][number]
): SupplementOnboardingReviewPacket["safetyWatchlist"]["acceptedPacketSignals"] {
  const fields = [
    {
      field: "adverseEvents",
      text: study.adverseEvents
    },
    {
      field: "riskOfBias",
      text: study.riskOfBias
    },
    {
      field: "fundingConflicts",
      text: study.fundingConflicts
    },
    {
      field: "population",
      text: study.population
    },
    {
      field: "intervention",
      text: study.intervention
    },
    {
      field: "outcomes",
      text: study.outcomes.join(" ")
    },
    {
      field: "title",
      text: study.title
    }
  ];

  return fields.flatMap(({ field, text }) => {
    const normalizedText = text.toLowerCase();

    return ACCEPTED_PACKET_SAFETY_RULES.map((rule) => {
      const matchedTerms = rule.terms.filter((term) =>
        normalizedText.includes(term)
      );

      if (matchedTerms.length === 0) {
        return undefined;
      }

      return {
        matchedTerms,
        referenceId: study.referenceId,
        requiredAction: rule.requiredAction,
        severity: rule.severity,
        signalId: rule.id,
        signalLabel: rule.label,
        sourceField: field,
        studyId: study.id,
        studyTitle: study.title
      };
    }).filter((signal): signal is NonNullable<typeof signal> => Boolean(signal));
  });
}

function proposedPublicWording({
  claim,
  regulatoryStatuses,
  sourcePacket
}: {
  claim: Claim;
  regulatoryStatuses: EvidenceDashboardData["australiaRegulatoryStatuses"];
  sourcePacket: ReturnType<typeof buildClaimSourcePacket>;
}): SupplementOnboardingReviewPacket["proposedPublicWording"] {
  return {
    citationTraceability:
      sourcePacket.completeness.status === "complete"
        ? `${sourcePacket.references.length} linked reference(s) with structured extraction.`
        : sourcePacket.completeness.detail,
    evidenceSummary: `${claim.finalLabel}: ${claim.claimText}`,
    regulatoryCaveat:
      regulatoryStatuses.length > 0 &&
      regulatoryStatuses.every((status) => status.kind !== "Unknown")
        ? "Product/regulatory wording must stay tied to the reviewed product-level status."
        : "No product-level AU/TGA confidence should be shown without reviewed product evidence.",
    safetyCaveat: claim.safetyNotes,
    status: "review-required",
    uncertaintyLabel: `${claim.confidenceLevel} confidence; ${claim.reviewStatus}.`
  };
}

function promotionDiff({
  claim,
  sourcePacket
}: {
  claim: Claim;
  sourcePacket: ReturnType<typeof buildClaimSourcePacket>;
}): SupplementOnboardingReviewPacket["promotionDiff"] {
  const blockers = promotionDiffBlockers({ claim, sourcePacket });
  const proposedReviewStatus = "Human reviewed" as const;

  return {
    auditMetadata: {
      noAutoPromotion: true,
      operatorPermission: "evidence:promote",
      requiredAction:
        "Explicit operator review/audit event required before public promotion.",
      targetId: claim.id,
      targetType: "Claim"
    },
    blockers,
    dashboardCards: {
      citationCount: sourcePacket.references.length,
      confidenceLevel: claim.confidenceLevel,
      evidenceLabel: claim.finalLabel,
      extractionStatus: sourcePacket.completeness.label,
      safetyNotes: claim.safetyNotes
    },
    publicClaimText: {
      changes: false,
      current: claim.claimText,
      proposed: claim.claimText
    },
    readOnly: true,
    readyForPromotionReview: blockers.length === 0,
    referenceLinks: {
      addedReferenceIds: [],
      currentReferenceIds: claim.keyReferenceIds,
      proposedReferenceIds: claim.keyReferenceIds,
      removedReferenceIds: []
    },
    scoreChanges: Object.entries(claim.scores).map(([metric, value]) => ({
      changes: false,
      current: value,
      metric,
      proposed: value
    })),
    uncertaintyLabels: {
      confidenceLevel: {
        changes: false,
        current: claim.confidenceLevel,
        proposed: claim.confidenceLevel
      },
      reviewStatus: {
        changes: claim.reviewStatus !== proposedReviewStatus,
        current: claim.reviewStatus,
        proposed: proposedReviewStatus
      }
    }
  };
}

function promotionDiffBlockers({
  claim,
  sourcePacket
}: {
  claim: Claim;
  sourcePacket: ReturnType<typeof buildClaimSourcePacket>;
}) {
  const blockers: string[] = [];

  if (sourcePacket.completeness.status !== "complete") {
    blockers.push(sourcePacket.completeness.nextStep);
  }

  if (!reviewStatusIsReviewed(claim.reviewStatus)) {
    blockers.push("Claim packet must be AI reviewed or Human reviewed before promotion review.");
  }

  if (claim.keyReferenceIds.length === 0) {
    blockers.push("Claim must have curated reference links before promotion review.");
  }

  return uniqueNonEmpty(blockers);
}

function reviewStatusIsReviewed(reviewStatus: Claim["reviewStatus"]) {
  return reviewStatus === "AI reviewed" || reviewStatus === "Human reviewed";
}

function reviewPacketStudy(study: Study) {
  return {
    adverseEvents: study.adverseEvents,
    fundingConflicts: study.fundingConflicts,
    id: study.id,
    intervention: study.intervention,
    outcomes: study.outcomes,
    population: study.population,
    referenceId: study.referenceId,
    riskOfBias: study.riskOfBias,
    sampleSize: study.sampleSize,
    studyType: study.studyType,
    title: study.title,
    year: study.year
  };
}

function findIntervention(interventions: Intervention[], supplementQuery: string) {
  const normalized = supplementQuery.trim().toLowerCase();

  return interventions.find(
    (intervention) =>
      intervention.id.toLowerCase() === normalized ||
      intervention.slug.toLowerCase() === normalized ||
      intervention.name.toLowerCase() === normalized
  );
}

function uniqueNonEmpty(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean))
  );
}
