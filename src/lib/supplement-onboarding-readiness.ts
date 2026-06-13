import type { Claim, EvidenceDashboardData, Intervention, ReviewStatus } from "@/lib/types";
import {
  getSourceConvictionRubric,
  type SourceConvictionRubric,
  SourceConvictionScoreBreakdown,
  SourceCandidateTriageRecommendation,
  SourceReputationLabel
} from "@/lib/source-conviction";

export type SupplementOnboardingReadinessStatus = "ready" | "blocked" | "warning";

export interface SupplementOnboardingSourceCandidateSignal {
  acceptedReferenceId?: string;
  claimId?: string;
  convictionLabel?: string;
  convictionLimitations?: string[];
  convictionPositiveFactors?: string[];
  convictionRubricVersion?: string;
  convictionScore?: number;
  convictionScoreBreakdown?: SourceConvictionScoreBreakdown;
  convictionUncertainty?: string;
  dedupeKey?: string;
  decision: string;
  externalId?: string;
  interventionId?: string;
  reviewStatus: string;
  sourceReputationLabel?: SourceReputationLabel;
  source?: string;
  title?: string;
  triageRationale?: string[];
  triageRecommendation?: SourceCandidateTriageRecommendation;
}

export interface SupplementOnboardingSourceJobSignal {
  claimId?: string;
  interventionId?: string;
  status: string;
}

export interface SupplementOnboardingSourceSignals {
  candidates?: SupplementOnboardingSourceCandidateSignal[];
  jobs?: SupplementOnboardingSourceJobSignal[];
  unavailableReason?: string;
}

export interface SupplementOnboardingReadinessCheck {
  detail: string;
  id: string;
  label: string;
  nextAction?: string;
  status: SupplementOnboardingReadinessStatus;
}

export interface SupplementOnboardingReadinessReport {
  checks: SupplementOnboardingReadinessCheck[];
  counts: Record<SupplementOnboardingReadinessStatus, number>;
  dataSource: EvidenceDashboardData["dataSource"];
  generatedAt: string;
  nextAction: string;
  overall: "ready" | "blocked";
  readOnly: true;
  sourceConviction?: {
    averageScore?: number;
    candidates: Array<{
      claimId?: string;
      dedupeKey?: string;
      decision: string;
      externalId?: string;
      label?: string;
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
      uncertainty?: string;
    }>;
    clusters: Array<{
      candidateCount: number;
      claimIds: string[];
      clusterKey: string;
      decisions: string[];
      externalId?: string;
      label?: string;
      limitations: string[];
      matchKind: "external-id" | "exact-title" | "fuzzy-title" | "dedupe";
      nextAction: string;
      score?: number;
      source?: string;
      sourceReputationLabel?: SourceReputationLabel;
      title?: string;
      titleVariants?: string[];
      triageRecommendation?: SourceCandidateTriageRecommendation;
    }>;
    rubric: SourceConvictionRubric;
  };
  supplement?: {
    claimCount: number;
    id: string;
    name: string;
    slug: string;
  };
  supplementQuery: string;
}

export interface SupplementOnboardingReadinessSummary {
  blockedChecks: SupplementOnboardingReadinessCheck[];
  counts: Record<SupplementOnboardingReadinessStatus, number>;
  dataSource: EvidenceDashboardData["dataSource"];
  generatedAt: string;
  nextAction: string;
  overall: "ready" | "blocked";
  readOnly: true;
  supplement?: SupplementOnboardingReadinessReport["supplement"];
  supplementQuery: string;
  warningChecks: SupplementOnboardingReadinessCheck[];
}

export function buildSupplementOnboardingReadinessReport({
  data,
  generatedAt = new Date(),
  sourceSignals,
  supplementQuery
}: {
  data: EvidenceDashboardData;
  generatedAt?: Date;
  sourceSignals?: SupplementOnboardingSourceSignals;
  supplementQuery: string;
}): SupplementOnboardingReadinessReport {
  const supplement = findIntervention(data.interventions, supplementQuery);
  const claims = supplement
    ? data.claims.filter((claim) => claim.interventionId === supplement.id)
    : [];
  const sourceConviction = supplement
    ? sourceConvictionFor(sourceSignals, supplement.id, claims.map((claim) => claim.id))
    : undefined;
  const checks = supplement
    ? checksForSupplement({
        claims,
        data,
        sourceSignals,
        supplement
      })
    : [
        {
          id: "intervention-present",
          label: "Intervention exists",
          status: "blocked" as const,
          detail: `No intervention matched ${supplementQuery}.`,
          nextAction:
            "Run npm run onboard:supplement to generate a draft, then add the reviewed intervention before source queueing."
        }
      ];
  const counts = countReadinessStatuses(checks);
  const firstBlocked = checks.find((check) => check.status === "blocked");

  return {
    checks,
    counts,
    dataSource: data.dataSource,
    generatedAt: generatedAt.toISOString(),
    nextAction:
      firstBlocked?.nextAction ??
      "Supplement onboarding gates are ready; continue with explicit human-owned promotion or launch review.",
    overall: counts.blocked > 0 ? "blocked" : "ready",
    readOnly: true,
    sourceConviction,
    supplement: supplement
      ? {
          claimCount: claims.length,
          id: supplement.id,
          name: supplement.name,
          slug: supplement.slug
        }
      : undefined,
    supplementQuery
  };
}

export function summarizeSupplementOnboardingReadinessReport(
  report: SupplementOnboardingReadinessReport
): SupplementOnboardingReadinessSummary {
  return {
    blockedChecks: report.checks.filter((check) => check.status === "blocked"),
    counts: report.counts,
    dataSource: report.dataSource,
    generatedAt: report.generatedAt,
    nextAction: report.nextAction,
    overall: report.overall,
    readOnly: true,
    supplement: report.supplement,
    supplementQuery: report.supplementQuery,
    warningChecks: report.checks.filter((check) => check.status === "warning")
  };
}

function checksForSupplement({
  claims,
  data,
  sourceSignals,
  supplement
}: {
  claims: Claim[];
  data: EvidenceDashboardData;
  sourceSignals?: SupplementOnboardingSourceSignals;
  supplement: Intervention;
}): SupplementOnboardingReadinessCheck[] {
  const claimIds = new Set(claims.map((claim) => claim.id));
  const candidates = sourceSignals?.candidates ?? [];
  const jobs = sourceSignals?.jobs ?? [];
  const relevantCandidates = candidates.filter(
    (candidate) =>
      candidate.interventionId === supplement.id ||
      (candidate.claimId ? claimIds.has(candidate.claimId) : false)
  );
  const relevantJobs = jobs.filter(
    (job) =>
      job.interventionId === supplement.id ||
      (job.claimId ? claimIds.has(job.claimId) : false)
  );

  return [
    {
      id: "intervention-present",
      label: "Intervention exists",
      status: "ready",
      detail: `${supplement.name} is present as ${supplement.id}.`
    },
    claimsCheck(claims),
    specificClaimCheck(claims),
    regulatoryCheck(data, supplement),
    sourceJobsCheck(sourceSignals, relevantJobs),
    sourceCandidatesCheck(sourceSignals, relevantCandidates),
    sourcePacketCheck(data, claims),
    humanReviewCheck(claims),
    {
      id: "guardrails",
      label: "Guardrails",
      status: "ready",
      detail:
        "Onboarding remains read-only until explicit source review, extraction, human review, and promotion actions are run."
    }
  ];
}

function claimsCheck(claims: Claim[]): SupplementOnboardingReadinessCheck {
  if (claims.length > 0) {
    return {
      id: "claims-present",
      label: "Draft claims",
      status: "ready",
      detail: `${claims.length} claim scope(s) are present.`
    };
  }

  return {
    id: "claims-present",
    label: "Draft claims",
    status: "blocked",
    detail: "No claim scopes are present for this supplement.",
    nextAction:
      "Add reviewed draft claims from the onboarding packet before queueing claim-scoped source discovery."
  };
}

function specificClaimCheck(claims: Claim[]): SupplementOnboardingReadinessCheck {
  const specificClaims = claims.filter(
    (claim) =>
      claim.outcome !== "Mortality/lifespan" &&
      claim.outcome !== "Safety/adverse effects"
  );

  if (specificClaims.length > 0) {
    return {
      id: "specific-use-case-claim",
      label: "Specific use-case claim",
      status: "ready",
      detail: `${specificClaims.length} non-safety/non-lifespan claim scope(s) are present.`
    };
  }

  return {
    id: "specific-use-case-claim",
    label: "Specific use-case claim",
    status: claims.length > 0 ? "warning" : "blocked",
    detail:
      "No specific non-safety/non-lifespan use-case claim is present yet.",
    nextAction:
      "Add at least one scoped use-case claim, such as sleep, lipids, cognition, strength, or glucose, before public scoring."
  };
}

function regulatoryCheck(
  data: EvidenceDashboardData,
  supplement: Intervention
): SupplementOnboardingReadinessCheck {
  const statuses = data.australiaRegulatoryStatuses.filter(
    (status) => status.interventionId === supplement.id
  );

  if (statuses.length === 0) {
    return {
      id: "au-tga-status",
      label: "AU/TGA status",
      status: "blocked",
      detail: "No AU/TGA intervention-level regulatory status record is present.",
      nextAction:
        "Add an explicit Unknown/Unverified AU/TGA status record or reviewed product-level status before public display."
    };
  }

  if (statuses.every((status) => status.kind === "Unknown")) {
    return {
      id: "au-tga-status",
      label: "AU/TGA status",
      status: "warning",
      detail:
        "AU/TGA status is explicitly recorded as Unknown; do not infer product-level AUST/ARTG status.",
      nextAction:
        "Review product-level ARTG/AUST evidence before making product authorisation claims."
    };
  }

  return {
    id: "au-tga-status",
    label: "AU/TGA status",
    status: "ready",
    detail: `${statuses.length} AU/TGA status record(s) are present.`
  };
}

function sourceJobsCheck(
  sourceSignals: SupplementOnboardingSourceSignals | undefined,
  jobs: SupplementOnboardingSourceJobSignal[]
): SupplementOnboardingReadinessCheck {
  if (sourceSignals?.unavailableReason) {
    return {
      id: "source-jobs",
      label: "Source discovery jobs",
      status: "warning",
      detail: `Source job state is unavailable: ${sourceSignals.unavailableReason}.`,
      nextAction:
        "Run onboarding readiness with a database-backed env file to inspect queued source discovery jobs."
    };
  }

  if (jobs.length > 0) {
    return {
      id: "source-jobs",
      label: "Source discovery jobs",
      status: "ready",
      detail: `${jobs.length} source discovery job(s) exist for this supplement context.`
    };
  }

  return {
    id: "source-jobs",
    label: "Source discovery jobs",
    status: "blocked",
    detail: "No source discovery jobs are queued or completed for this supplement.",
    nextAction:
      "Run npm run onboarding:queue-sources -- --supplement <id> after the intervention and claims exist."
  };
}

function sourceCandidatesCheck(
  sourceSignals: SupplementOnboardingSourceSignals | undefined,
  candidates: SupplementOnboardingSourceCandidateSignal[]
): SupplementOnboardingReadinessCheck {
  if (sourceSignals?.unavailableReason) {
    return {
      id: "source-candidates",
      label: "Source candidates",
      status: "warning",
      detail: `Source candidate state is unavailable: ${sourceSignals.unavailableReason}.`,
      nextAction:
        "Run onboarding readiness with a database-backed env file after source jobs have run."
    };
  }

  if (candidates.length === 0) {
    return {
      id: "source-candidates",
      label: "Source candidates",
      status: "blocked",
      detail: "No source candidates exist for this supplement context.",
      nextAction:
        "Run queued source discovery jobs, then review candidates before any acceptance or promotion."
    };
  }

  const reviewedCount = candidates.filter(
    (candidate) => candidate.decision !== "PENDING_REVIEW"
  ).length;
  const convictionScores = candidates
    .map((candidate) => candidate.convictionScore)
    .filter((score): score is number => typeof score === "number");
  const clusters = sourceCandidateClusters(candidates.map(sourceConvictionCandidate));
  const topConviction = clusters[0];
  const averageConviction =
    convictionScores.length > 0
      ? Math.round(
          convictionScores.reduce((total, score) => total + score, 0) /
            convictionScores.length
        )
      : undefined;

  return {
    id: "source-candidates",
    label: "Source candidates",
    status: reviewedCount > 0 ? "ready" : "warning",
    detail:
      averageConviction === undefined
        ? `${candidates.length} candidate(s) exist in ${clusters.length} cluster(s); ${reviewedCount} have accept/reject decisions.`
        : `${candidates.length} candidate(s) exist in ${clusters.length} cluster(s); ${reviewedCount} have accept/reject decisions; average source conviction ${averageConviction}/100; top cluster ${formatTopCluster(topConviction)}.`,
    nextAction:
      reviewedCount > 0
        ? undefined
        : "Review source candidates and their conviction explanations before linking references or extracting studies."
  };
}

function sourceConvictionFor(
  sourceSignals: SupplementOnboardingSourceSignals | undefined,
  supplementId: string,
  claimIds: string[]
): SupplementOnboardingReadinessReport["sourceConviction"] {
  const claimIdSet = new Set(claimIds);
  const candidates = (sourceSignals?.candidates ?? [])
    .filter(
      (candidate) =>
        candidate.interventionId === supplementId ||
        (candidate.claimId ? claimIdSet.has(candidate.claimId) : false)
    )
    .map(sourceConvictionCandidate)
    .sort(compareConvictionCandidates);
  const scores = candidates
    .map((candidate) => candidate.score)
    .filter((score): score is number => typeof score === "number");

  if (candidates.length === 0) {
    return undefined;
  }

  return {
    averageScore:
      scores.length > 0
        ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length)
        : undefined,
    candidates,
    clusters: sourceCandidateClusters(candidates),
    rubric: getSourceConvictionRubric()
  };
}

function sourceConvictionCandidate(candidate: SupplementOnboardingSourceCandidateSignal) {
  return {
    claimId: candidate.claimId,
    dedupeKey: candidate.dedupeKey,
    decision: candidate.decision,
    externalId: candidate.externalId,
    label: candidate.convictionLabel,
    limitations: candidate.convictionLimitations ?? [],
    positiveFactors: candidate.convictionPositiveFactors ?? [],
    score: candidate.convictionScore,
    rubricVersion: candidate.convictionRubricVersion,
    scoreBreakdown: candidate.convictionScoreBreakdown,
    source: candidate.source,
    sourceReputationLabel: candidate.sourceReputationLabel,
    title: candidate.title,
    triageRationale: candidate.triageRationale ?? [],
    triageRecommendation: candidate.triageRecommendation,
    uncertainty: candidate.convictionUncertainty
  };
}

type SourceConvictionCandidate = ReturnType<typeof sourceConvictionCandidate>;

interface SourceCandidateTitleFingerprint {
  canonical: string;
  normalized: string;
  tokens: string[];
}

interface SourceCandidateClusterGroup {
  candidates: SourceConvictionCandidate[];
  clusterKey: string;
  matchKind: NonNullable<
    SupplementOnboardingReadinessReport["sourceConviction"]
  >["clusters"][number]["matchKind"];
  titleFingerprint?: SourceCandidateTitleFingerprint;
}

const FUZZY_TITLE_CLUSTER_LIMITATION =
  "Fuzzy title cluster; confirm duplicate identity before accepting.";

const SOURCE_TITLE_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "by",
  "for",
  "from",
  "in",
  "into",
  "of",
  "on",
  "or",
  "supplement",
  "supplementation",
  "the",
  "to",
  "with"
]);

const SOURCE_TITLE_TOKEN_REPLACEMENTS: Record<string, string> = {
  ageing: "aging",
  randomised: "randomized",
  randomisation: "randomization"
};

function sourceCandidateClusters(
  candidates: SourceConvictionCandidate[]
): NonNullable<SupplementOnboardingReadinessReport["sourceConviction"]>["clusters"] {
  const groups: SourceCandidateClusterGroup[] = [];

  for (const candidate of [...candidates].sort(compareConvictionCandidates)) {
    const source = normalizeClusterPart(candidate.source ?? "unknown-source");
    const externalId = normalizeClusterPart(candidate.externalId ?? "");

    if (externalId) {
      addCandidateToClusterGroup(groups, {
        candidate,
        clusterKey: `${source}|external-id|${externalId}`,
        matchKind: "external-id"
      });
      continue;
    }

    const titleFingerprint = sourceCandidateTitleFingerprint(candidate.title);

    if (titleFingerprint) {
      const exactTitleKey = `title|${titleFingerprint.normalized}`;
      const matchingGroup = groups.find(
        (group) =>
          group.clusterKey === exactTitleKey ||
          (group.titleFingerprint
            ? sourceCandidateTitlesMatch(group.titleFingerprint, titleFingerprint)
            : false)
      );

      if (matchingGroup) {
        const exactTitleMatch =
          matchingGroup.titleFingerprint?.normalized === titleFingerprint.normalized;
        matchingGroup.candidates.push(candidate);

        if (!exactTitleMatch) {
          matchingGroup.clusterKey = `title-fuzzy|${matchingGroup.titleFingerprint?.canonical ?? titleFingerprint.canonical}`;
          matchingGroup.matchKind = "fuzzy-title";
        }
        continue;
      }

      groups.push({
        candidates: [candidate],
        clusterKey: exactTitleKey,
        matchKind: "exact-title",
        titleFingerprint
      });
      continue;
    }

    addCandidateToClusterGroup(groups, {
      candidate,
      clusterKey: `${source}|dedupe|${normalizeClusterPart(candidate.dedupeKey ?? "unknown")}`,
      matchKind: "dedupe"
    });
  }

  return groups
    .map((group) => {
      const candidatesInGroup = group.candidates;
      const ranked = [...candidatesInGroup].sort(compareConvictionCandidates);
      const top = ranked[0];
      const titleVariants = uniqueSorted(
        candidatesInGroup.map((candidate) => candidate.title)
      );
      const fuzzyLimitations =
        group.matchKind === "fuzzy-title"
          ? [FUZZY_TITLE_CLUSTER_LIMITATION]
          : [];

      return {
        candidateCount: candidatesInGroup.length,
        claimIds: uniqueSorted(candidatesInGroup.map((candidate) => candidate.claimId)),
        clusterKey: group.clusterKey,
        decisions: uniqueSorted(candidatesInGroup.map((candidate) => candidate.decision)),
        externalId: top.externalId,
        label: top.label,
        limitations: uniqueSorted(
          candidatesInGroup
            .flatMap((candidate) => candidate.limitations ?? [])
            .concat(fuzzyLimitations)
        ),
        matchKind: group.matchKind,
        nextAction: sourceCandidateClusterNextAction(top),
        score: top.score,
        source: top.source,
        sourceReputationLabel: top.sourceReputationLabel,
        title: top.title,
        titleVariants: titleVariants.length > 1 ? titleVariants : undefined,
        triageRecommendation: top.triageRecommendation
      };
    })
    .sort(compareConvictionClusters);
}

function addCandidateToClusterGroup(
  groups: SourceCandidateClusterGroup[],
  {
    candidate,
    clusterKey,
    matchKind
  }: {
    candidate: SourceConvictionCandidate;
    clusterKey: string;
    matchKind: SourceCandidateClusterGroup["matchKind"];
  }
) {
  const matchingGroup = groups.find((group) => group.clusterKey === clusterKey);

  if (matchingGroup) {
    matchingGroup.candidates.push(candidate);
    return;
  }

  groups.push({
    candidates: [candidate],
    clusterKey,
    matchKind
  });
}

function sourceCandidateTitleFingerprint(
  title: string | undefined
): SourceCandidateTitleFingerprint | undefined {
  const normalized = normalizeClusterPart(title ?? "");

  if (!normalized) {
    return undefined;
  }

  const tokens = normalized
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map(normalizeSourceCandidateTitleToken)
    .filter(
      (token) =>
        token.length > 1 &&
        !SOURCE_TITLE_STOPWORDS.has(token)
    );
  const uniqueTokens = Array.from(new Set(tokens)).sort((left, right) =>
    left.localeCompare(right)
  );

  return {
    canonical: uniqueTokens.join(" "),
    normalized,
    tokens: uniqueTokens
  };
}

function normalizeSourceCandidateTitleToken(token: string) {
  let normalized = SOURCE_TITLE_TOKEN_REPLACEMENTS[token] ?? token;

  if (normalized.endsWith("ies") && normalized.length > 5) {
    normalized = `${normalized.slice(0, -3)}y`;
  } else if (normalized.endsWith("s") && normalized.length > 4) {
    normalized = normalized.slice(0, -1);
  }

  return SOURCE_TITLE_TOKEN_REPLACEMENTS[normalized] ?? normalized;
}

function sourceCandidateTitlesMatch(
  left: SourceCandidateTitleFingerprint,
  right: SourceCandidateTitleFingerprint
) {
  if (left.normalized === right.normalized) {
    return true;
  }

  const leftTokens = new Set(left.tokens);
  const rightTokens = new Set(right.tokens);
  const intersectionCount = left.tokens.filter((token) => rightTokens.has(token)).length;
  const unionCount = new Set([...leftTokens, ...rightTokens]).size;
  const smallerTokenCount = Math.min(leftTokens.size, rightTokens.size);

  if (unionCount === 0 || smallerTokenCount === 0) {
    return false;
  }

  const jaccard = intersectionCount / unionCount;
  const containment = intersectionCount / smallerTokenCount;

  return (
    (intersectionCount >= 5 && jaccard >= 0.82) ||
    (intersectionCount >= 6 && containment >= 0.92)
  );
}

function compareConvictionClusters(
  left: NonNullable<SupplementOnboardingReadinessReport["sourceConviction"]>["clusters"][number],
  right: NonNullable<SupplementOnboardingReadinessReport["sourceConviction"]>["clusters"][number]
) {
  return (
    (right.score ?? -1) - (left.score ?? -1) ||
    right.candidateCount - left.candidateCount ||
    left.clusterKey.localeCompare(right.clusterKey)
  );
}

function compareConvictionCandidates(
  left: { score?: number; title?: string },
  right: { score?: number; title?: string }
) {
  return (
    (right.score ?? -1) - (left.score ?? -1) ||
    (left.title ?? "").localeCompare(right.title ?? "")
  );
}

function sourceCandidateClusterNextAction(candidate: {
  label?: string;
  score?: number;
  triageRecommendation?: SourceCandidateTriageRecommendation;
}) {
  if (candidate.triageRecommendation === "review-first") {
    return "Review this cluster first for possible accepted-reference matching; confirmation is still explicit.";
  }

  if (candidate.triageRecommendation === "review-after-stronger-sources") {
    return "Review after first-pass clusters and confirm claim fit before accepting.";
  }

  if (candidate.triageRecommendation === "limitations-only") {
    return "Use as limitation or secondary context unless stronger reviewed evidence is unavailable.";
  }

  if (candidate.triageRecommendation === "hold-or-reject") {
    return "Hold or reject unless manual review finds strong claim-scoped relevance.";
  }

  if (candidate.score === undefined) {
    return "Review candidate metadata before using this cluster for evidence decisions.";
  }

  if (candidate.score >= 75) {
    return "Review this high-conviction cluster first for possible accepted-reference matching.";
  }

  if (candidate.score >= 55) {
    return "Review after high-conviction clusters and confirm relevance before accepting.";
  }

  return "Treat as lower-priority or limitation-heavy unless no stronger source covers the claim.";
}

function formatTopCluster(
  cluster?: NonNullable<SupplementOnboardingReadinessReport["sourceConviction"]>["clusters"][number]
) {
  if (!cluster) {
    return "unavailable";
  }

  return `${cluster.score ?? "unscored"}/100 ${cluster.label ?? "unlabeled"} ${cluster.source ?? "source unknown"}`;
}

function uniqueSorted(values: Array<string | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))
  ).sort((left, right) => left.localeCompare(right));
}

function normalizeClusterPart(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function sourcePacketCheck(
  data: EvidenceDashboardData,
  claims: Claim[]
): SupplementOnboardingReadinessCheck {
  if (claims.length === 0) {
    return {
      id: "source-packets",
      label: "Source packets",
      status: "blocked",
      detail: "No claims exist, so source packets cannot be complete.",
      nextAction: "Add reviewed draft claims before building source packets."
    };
  }

  const completeClaims = claims.filter((claim) => claimPacketComplete(data, claim));

  if (completeClaims.length === claims.length) {
    return {
      id: "source-packets",
      label: "Source packets",
      status: "ready",
      detail: `All ${claims.length} claim source packet(s) have linked references and extracted studies.`
    };
  }

  return {
    id: "source-packets",
    label: "Source packets",
    status: "blocked",
    detail: `${completeClaims.length}/${claims.length} claim source packet(s) are complete.`,
    nextAction:
      "Accept matching candidates, link curated references to claims, and extract structured study metadata."
  };
}

function humanReviewCheck(claims: Claim[]): SupplementOnboardingReadinessCheck {
  const reviewedClaims = claims.filter((claim) => humanReviewed(claim.reviewStatus));

  if (claims.length > 0 && reviewedClaims.length === claims.length) {
    return {
      id: "human-review",
      label: "Human review",
      status: "ready",
      detail: `All ${claims.length} claim(s) are human-reviewed.`
    };
  }

  return {
    id: "human-review",
    label: "Human review",
    status: "blocked",
    detail: `${reviewedClaims.length}/${claims.length} claim(s) are human-reviewed.`,
    nextAction:
      "Mark claim packets human-reviewed only after citation traceability, extraction, uncertainty labels, and caveats are checked."
  };
}

function claimPacketComplete(data: EvidenceDashboardData, claim: Claim) {
  if (claim.keyReferenceIds.length === 0) {
    return false;
  }

  return claim.keyReferenceIds.every((referenceId) =>
    data.studies.some((study) => study.referenceId === referenceId)
  );
}

function humanReviewed(reviewStatus: ReviewStatus) {
  return reviewStatus === "Human reviewed";
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

function countReadinessStatuses(checks: SupplementOnboardingReadinessCheck[]) {
  return checks.reduce(
    (counts, check) => ({
      ...counts,
      [check.status]: counts[check.status] + 1
    }),
    {
      blocked: 0,
      ready: 0,
      warning: 0
    } satisfies Record<SupplementOnboardingReadinessStatus, number>
  );
}
