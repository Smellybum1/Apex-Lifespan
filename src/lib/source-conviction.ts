import type { SourceCandidate, SourceCandidateSource } from "@/lib/types";

export type SourceConvictionLabel = "High" | "Moderate" | "Low" | "Very low";
export type SourceCandidateTriageRecommendation =
  | "review-first"
  | "review-after-stronger-sources"
  | "limitations-only"
  | "hold-or-reject";
export type SourceReputationLabel = "high-repute" | "moderate-repute" | "lower-repute";

export interface SourceConvictionScoreBreakdown {
  abstractAvailability: number;
  cappedScore: number;
  rawScore: number;
  recency: number;
  sourceReputation: number;
  studyDesign: number;
  titleQueryOverlapPenalty: number;
  traceability: number;
  triageSignal: number;
}

export interface SourceConvictionRubric {
  components: Array<{
    id: keyof Omit<SourceConvictionScoreBreakdown, "cappedScore" | "rawScore">;
    maxPenalty?: number;
    maxPoints?: number;
    rationale: string;
  }>;
  guardrails: string[];
  labelBands: Array<{
    label: SourceConvictionLabel;
    minScore: number;
  }>;
  maxScore: 100;
  sourceReputationWeights: Array<{
    label: SourceReputationLabel;
    points: number;
    rationale: string;
    source: SourceCandidateSource | "recognized-fallback";
  }>;
  studyDesignWeights: Array<{
    id: string;
    points: number;
    rationale: string;
  }>;
  version: string;
}

export interface SourceConvictionAssessment {
  label: SourceConvictionLabel;
  limitations: string[];
  positiveFactors: string[];
  rubricVersion: string;
  score: number;
  scoreBreakdown: SourceConvictionScoreBreakdown;
  sourceReputationLabel: SourceReputationLabel;
  sourceReputation: number;
  studyDesign: number;
  traceability: number;
  triageRationale: string[];
  triageRecommendation: SourceCandidateTriageRecommendation;
  uncertainty: string;
}

const SOURCE_REPUTATION_WEIGHTS: Record<SourceCandidateSource, number> = {
  PubMed: 30,
  "ClinicalTrials.gov": 24
};

const STUDY_TYPE_WEIGHTS: Array<{
  id: string;
  match: RegExp;
  reason: string;
  weight: number;
}> = [
  {
    id: "review-synthesis",
    match: /meta[- ]analysis|systematic review/i,
    reason: "systematic review/meta-analysis design",
    weight: 30
  },
  {
    id: "human-trial",
    match: /randomi[sz]ed|controlled trial|clinical trial/i,
    reason: "human trial design",
    weight: 24
  },
  {
    id: "observational-human",
    match: /observational|cohort|case-control/i,
    reason: "observational human evidence",
    weight: 16
  },
  {
    id: "case-level",
    match: /case report|case series/i,
    reason: "case-level evidence",
    weight: 8
  },
  {
    id: "preclinical",
    match: /animal|in vitro|mechanistic/i,
    reason: "preclinical/mechanistic evidence",
    weight: 5
  },
  {
    id: "trial-registry",
    match: /trial record|registry/i,
    reason: "trial registry record",
    weight: 12
  }
];

const SOURCE_CONVICTION_RUBRIC: SourceConvictionRubric = {
  components: [
    {
      id: "sourceReputation",
      maxPoints: 30,
      rationale:
        "Reputable, traceable biomedical indexes receive more starting weight than less established source classes."
    },
    {
      id: "studyDesign",
      maxPoints: 30,
      rationale:
        "Evidence syntheses and human trials are weighted above observational, case-level, registry-only, preclinical, or unclear records."
    },
    {
      id: "traceability",
      maxPoints: 14,
      rationale:
        "External identifiers and stable URLs help operators verify the source and preserve citation traceability."
    },
    {
      id: "recency",
      maxPoints: 8,
      rationale:
        "Recent or modern records get a small boost while older records can still rank if other signals are strong."
    },
    {
      id: "abstractAvailability",
      maxPoints: 8,
      rationale:
        "Available abstracts improve first-pass reviewability but do not replace full human review."
    },
    {
      id: "triageSignal",
      maxPoints: 12,
      rationale:
        "Existing ingestion triage cues can lift a candidate, capped so they cannot override weak source quality by themselves."
    },
    {
      id: "titleQueryOverlapPenalty",
      maxPenalty: 12,
      rationale: "Weak title/query overlap lowers conviction until claim relevance is checked."
    }
  ],
  guardrails: [
    "Source conviction is review-priority decision support, not an evidence grade.",
    "Higher conviction does not accept a candidate, write extraction rows, mark claim review, or promote public evidence.",
    "Lower conviction candidates can still be summarized as limitations when operator review finds relevant context.",
    "Product-level AU/TGA status is never inferred from source conviction."
  ],
  labelBands: [
    {
      label: "High",
      minScore: 75
    },
    {
      label: "Moderate",
      minScore: 55
    },
    {
      label: "Low",
      minScore: 35
    },
    {
      label: "Very low",
      minScore: 0
    }
  ],
  maxScore: 100,
  sourceReputationWeights: [
    {
      label: "high-repute",
      points: 30,
      rationale: "PubMed-indexed biomedical records get the strongest source-reputation weight.",
      source: "PubMed"
    },
    {
      label: "moderate-repute",
      points: 24,
      rationale: "ClinicalTrials.gov records are reputable registry sources but may lack results.",
      source: "ClinicalTrials.gov"
    },
    {
      label: "lower-repute",
      points: 10,
      rationale: "Recognized fallback source classes start lower until stronger provenance is implemented.",
      source: "recognized-fallback"
    }
  ],
  studyDesignWeights: STUDY_TYPE_WEIGHTS.map((item) => ({
    id: item.id,
    points: item.weight,
    rationale: item.reason
  })),
  version: "2026-06-13"
};

export function getSourceConvictionRubric(): SourceConvictionRubric {
  return SOURCE_CONVICTION_RUBRIC;
}

export function assessSourceCandidateConviction(
  candidate: SourceCandidate
): SourceConvictionAssessment {
  const positiveFactors: string[] = [];
  const limitations: string[] = [];
  const sourceReputation = SOURCE_REPUTATION_WEIGHTS[candidate.source] ?? 10;
  const studyDesignAssessment = assessStudyDesign(candidate.sourceType);
  const traceability = assessTraceability(candidate);
  const recencyScore = assessRecency(candidate.publishedYear);
  const abstractScore = candidate.abstractAvailable ? 8 : 0;
  const triageSignal = Math.min(Math.max(candidate.triageScore, 0), 100) * 0.12;
  const titleQueryOverlapPenalty = lowTitleQueryOverlap(candidate) ? 12 : 0;
  const rawScore =
    sourceReputation +
      studyDesignAssessment.weight +
      traceability.score +
      recencyScore.score +
      abstractScore +
      triageSignal -
      titleQueryOverlapPenalty;
  const score = clampScore(rawScore);
  const sourceReputationLabel = sourceReputationBand(candidate.source);

  positiveFactors.push(sourceReputationReason(candidate.source));

  if (studyDesignAssessment.reason) {
    positiveFactors.push(studyDesignAssessment.reason);
  } else {
    limitations.push("study design was not clearly classified from candidate metadata");
  }

  if (traceability.score >= 12) {
    positiveFactors.push("candidate has strong identifier and URL traceability");
  } else {
    limitations.push("candidate traceability is incomplete");
  }

  if (candidate.abstractAvailable) {
    positiveFactors.push("abstract is available for review");
  } else {
    limitations.push("abstract was not available from the candidate metadata");
  }

  if (recencyScore.reason) {
    positiveFactors.push(recencyScore.reason);
  }

  if (titleQueryOverlapPenalty > 0) {
    limitations.push("title/query overlap is weak; review relevance before relying on it");
  }

  if (candidate.triageReasons.length > 0) {
    positiveFactors.push(`triage cues: ${candidate.triageReasons.slice(0, 3).join("; ")}`);
  }
  const triage = sourceCandidateTriage({
    candidate,
    label: convictionLabel(score),
    limitations,
    score,
    sourceReputationLabel,
    studyDesign: studyDesignAssessment.weight,
    titlePenalty: titleQueryOverlapPenalty,
    traceabilityScore: traceability.score
  });

  return {
    label: convictionLabel(score),
    limitations,
    positiveFactors,
    rubricVersion: SOURCE_CONVICTION_RUBRIC.version,
    score,
    scoreBreakdown: {
      abstractAvailability: abstractScore,
      cappedScore: score,
      rawScore: Math.round(rawScore),
      recency: recencyScore.score,
      sourceReputation,
      studyDesign: studyDesignAssessment.weight,
      titleQueryOverlapPenalty,
      traceability: traceability.score,
      triageSignal: Math.round(triageSignal)
    },
    sourceReputationLabel,
    sourceReputation,
    studyDesign: studyDesignAssessment.weight,
    traceability: traceability.score,
    triageRationale: triage.rationale,
    triageRecommendation: triage.recommendation,
    uncertainty:
      "Source conviction is a review-priority signal, not an automatic evidence grade or human-review substitute."
  };
}

function assessStudyDesign(sourceType?: string) {
  if (!sourceType) {
    return {
      weight: 0
    };
  }

  const matched = STUDY_TYPE_WEIGHTS.find((candidate) => candidate.match.test(sourceType));

  return matched
    ? {
        reason: matched.reason,
        weight: matched.weight
      }
    : {
        weight: 6
      };
}

function assessTraceability(candidate: SourceCandidate) {
  const hasExternalId = candidate.externalId.trim().length > 0;
  const hasUrl = candidate.url.trim().length > 0;
  const score = (hasExternalId ? 8 : 0) + (hasUrl ? 6 : 0);

  return {
    score
  };
}

function assessRecency(year?: number) {
  if (!year) {
    return {
      score: 0
    };
  }

  if (year >= 2020) {
    return {
      reason: "recent publication or record",
      score: 8
    };
  }

  if (year >= 2010) {
    return {
      reason: "modern publication or record",
      score: 5
    };
  }

  return {
    score: 2
  };
}

function lowTitleQueryOverlap(candidate: SourceCandidate) {
  const titleTokens = tokenSet(candidate.title);
  const queryTokens = tokenSet(candidate.query);

  if (queryTokens.size < 3) {
    return false;
  }

  let overlap = 0;

  for (const token of queryTokens) {
    if (titleTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap === 0;
}

function tokenSet(value: string) {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 2)
  );
}

function sourceReputationReason(source: SourceCandidateSource) {
  if (source === "PubMed") {
    return "PubMed-indexed biomedical source";
  }

  if (source === "ClinicalTrials.gov") {
    return "ClinicalTrials.gov registry source";
  }

  return "recognized source type";
}

function sourceReputationBand(source: SourceCandidateSource): SourceReputationLabel {
  if (source === "PubMed") {
    return "high-repute";
  }

  if (source === "ClinicalTrials.gov") {
    return "moderate-repute";
  }

  return "lower-repute";
}

function sourceCandidateTriage({
  candidate,
  label,
  limitations,
  score,
  sourceReputationLabel,
  studyDesign,
  titlePenalty,
  traceabilityScore
}: {
  candidate: SourceCandidate;
  label: SourceConvictionLabel;
  limitations: string[];
  score: number;
  sourceReputationLabel: SourceReputationLabel;
  studyDesign: number;
  titlePenalty: number;
  traceabilityScore: number;
}): {
  rationale: string[];
  recommendation: SourceCandidateTriageRecommendation;
} {
  const rationale = [
    `${sourceReputationLabel} source with ${label.toLowerCase()} conviction (${score}/100).`
  ];

  if (score >= 75 && traceabilityScore >= 12 && titlePenalty === 0) {
    rationale.push("Strong traceability and relevance signals make this a first-pass review candidate.");
    return {
      rationale,
      recommendation: "review-first"
    };
  }

  if (score >= 55) {
    rationale.push("Moderate support; confirm claim fit and study details after stronger candidates.");
    return {
      rationale,
      recommendation: "review-after-stronger-sources"
    };
  }

  if (
    score < 35 ||
    limitations.some((limitation) => limitation.includes("title/query overlap is weak"))
  ) {
    rationale.push("Weak relevance or low conviction means this should not support the packet by itself.");
    return {
      rationale,
      recommendation: "hold-or-reject"
    };
  }

  rationale.push(
    studyDesign <= 8 || !candidate.abstractAvailable
      ? "Use as limitation or context unless stronger human evidence is unavailable."
      : "Use as secondary context only after higher-conviction records are reviewed."
  );
  return {
    rationale,
    recommendation: "limitations-only"
  };
}

function convictionLabel(score: number): SourceConvictionLabel {
  if (score >= 75) {
    return "High";
  }

  if (score >= 55) {
    return "Moderate";
  }

  if (score >= 35) {
    return "Low";
  }

  return "Very low";
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}
