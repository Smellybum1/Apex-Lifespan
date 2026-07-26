import { labelTrialWatchItem } from "@/lib/trial-registry-labels";
import type {
  AustraliaRegulatoryStatus,
  Claim,
  ConfidenceLevel,
  EvidenceDashboardData,
  Intervention,
  Reference,
  ReviewStatus,
  SafetyAlert,
  Study,
  TrialWatchItem
} from "@/lib/types";

export type LifespanEvidenceStageId =
  | "human-outcomes"
  | "healthspan"
  | "biomarkers"
  | "preclinical"
  | "experimental-watchlist"
  | "source-leads";

export interface LifespanEvidenceStage {
  id: LifespanEvidenceStageId;
  label: string;
  shortLabel: string;
  description: string;
  caution: string;
}

export interface LifespanEvidenceRecord {
  intervention: Intervention;
  stageId: LifespanEvidenceStageId;
  primaryClaim?: Claim;
  relevantClaims: Claim[];
  references: Reference[];
  studies: Study[];
  trials: TrialWatchItem[];
  safetyAlerts: SafetyAlert[];
  australiaStatuses: AustraliaRegulatoryStatus[];
  sourceCount: number;
  extractedSourceCount: number;
  confidence?: ConfidenceLevel;
  reviewStatus?: ReviewStatus;
  finding: string;
  limitation: string;
  lastUpdated: string;
}

export interface LifespanTrialUpdate {
  trial: TrialWatchItem;
  intervention: Intervention;
  relevanceLabel: string;
  relevanceDetail: string;
}

export interface LifespanEvidenceData {
  records: LifespanEvidenceRecord[];
  featuredRecords: LifespanEvidenceRecord[];
  stages: Array<LifespanEvidenceStage & { records: LifespanEvidenceRecord[] }>;
  latestTrialUpdates: LifespanTrialUpdate[];
  summary: {
    trackedSubjects: number;
    directLifespanClaims: number;
    lowCertaintyDirectClaims: number;
    humanLinkedSubjects: number;
    activeTrials: number;
  };
  dataSource: EvidenceDashboardData["dataSource"];
  fallbackReason?: string;
}

export const LIFESPAN_EVIDENCE_STAGES: readonly LifespanEvidenceStage[] = [
  {
    id: "human-outcomes",
    label: "Human outcome sources linked",
    shortLabel: "Human outcomes",
    description:
      "Human trials, observational studies, or research syntheses are linked to a human-reviewed lifespan or mortality claim.",
    caution:
      "A linked human source is not proof that the intervention extends life. Read the finding, endpoint, confidence, and source packet together."
  },
  {
    id: "healthspan",
    label: "Human healthspan or function sources linked",
    shortLabel: "Healthspan and function",
    description:
      "Human research is linked to a human-reviewed function, resilience, or clinical health outcome for a tracked lifespan subject.",
    caution:
      "A benefit for one health outcome does not establish longer life or a broad slowing of biological ageing."
  },
  {
    id: "biomarkers",
    label: "Human ageing-marker sources linked",
    shortLabel: "Ageing markers",
    description:
      "Human research is linked to a human-reviewed biological-age or ageing-marker claim.",
    caution:
      "A younger-looking biomarker or ageing clock does not establish longer life or better health."
  },
  {
    id: "preclinical",
    label: "Animal or laboratory evidence",
    shortLabel: "Preclinical",
    description:
      "The linked evidence is currently animal, cell, or mechanistic research rather than a human outcome study.",
    caution:
      "Animal lifespan and laboratory findings are research leads. They do not demonstrate a human benefit."
  },
  {
    id: "experimental-watchlist",
    label: "Experimental or regulated watchlist",
    shortLabel: "Watchlist",
    description:
      "A geroprotector or experimental intervention is being tracked, but the local lifespan source packet is not mature enough for another lane.",
    caution:
      "This is evidence and safety tracking, not a recommendation or self-use guide."
  },
  {
    id: "source-leads",
    label: "Source leads still being resolved",
    shortLabel: "Source work",
    description:
      "A lifespan or ageing claim exists locally, but structured extraction or source relevance is still incomplete.",
    caution:
      "Treat these as research leads, not settled findings or ranked benefits."
  }
] as const;

const CORE_LIFESPAN_OUTCOMES = new Set<Claim["outcome"]>([
  "Mortality/lifespan",
  "Biological aging clocks"
]);

const HEALTHSPAN_OUTCOMES = new Set<Claim["outcome"]>([
  "Muscle/strength",
  "VO2 max/endurance"
]);

const HUMAN_RESULT_STUDY_TYPES = new Set<Study["studyType"]>([
  "Meta-analysis",
  "Systematic review",
  "Randomized controlled trial",
  "Observational cohort"
]);

const PRECLINICAL_STUDY_TYPES = new Set<Study["studyType"]>([
  "Animal study",
  "In vitro/mechanistic"
]);

const ACTIVE_TRIAL_STATUSES = new Set<TrialWatchItem["status"]>([
  "Recruiting",
  "Active",
  "Results pending"
]);

const CONFIDENCE_PRIORITY: Record<ConfidenceLevel, number> = {
  High: 4,
  Moderate: 3,
  Low: 2,
  "Very low": 1
};

const STAGE_PRIORITY: Record<LifespanEvidenceStageId, number> = {
  "human-outcomes": 6,
  healthspan: 5,
  biomarkers: 4,
  preclinical: 3,
  "experimental-watchlist": 2,
  "source-leads": 1
};

export function selectLifespanEvidence(data: EvidenceDashboardData): LifespanEvidenceData {
  const lifespanClaims = data.claims.filter((claim) =>
    CORE_LIFESPAN_OUTCOMES.has(claim.outcome)
  );
  const lifespanClaimsByIntervention = groupBy(lifespanClaims, (claim) => claim.interventionId);
  const candidateInterventions = data.interventions.filter(
    (intervention) =>
      lifespanClaimsByIntervention.has(intervention.id) ||
      intervention.category === "Drug/geroprotector watchlist"
  );
  const candidateIds = new Set(candidateInterventions.map((intervention) => intervention.id));
  const relevantClaims = data.claims.filter(
    (claim) =>
      candidateIds.has(claim.interventionId) &&
      (CORE_LIFESPAN_OUTCOMES.has(claim.outcome) || HEALTHSPAN_OUTCOMES.has(claim.outcome))
  );
  const relevantClaimsByIntervention = groupBy(relevantClaims, (claim) => claim.interventionId);
  const referencesById = new Map(data.references.map((reference) => [reference.id, reference]));
  const studiesByReferenceId = groupBy(data.studies, (study) => study.referenceId);
  const trialsByIntervention = groupBy(
    data.trialWatchItems.filter((trial) => candidateIds.has(trial.interventionId)),
    (trial) => trial.interventionId
  );
  const alertsByIntervention = groupBy(
    data.safetyAlerts.filter((alert) => candidateIds.has(alert.interventionId)),
    (alert) => alert.interventionId
  );
  const statusesByIntervention = groupBy(
    data.australiaRegulatoryStatuses.filter(
      (status) =>
        status.interventionId !== undefined &&
        status.productId === undefined &&
        candidateIds.has(status.interventionId)
    ),
    (status) => status.interventionId as string
  );
  const sourcePacketsByClaimId = new Map(
    (data.normalizedSourcePackets ?? []).map((packet) => [packet.claimId, packet])
  );

  const records = candidateInterventions
    .map((intervention): LifespanEvidenceRecord => {
      const claims = [...(relevantClaimsByIntervention.get(intervention.id) ?? [])].sort(
        compareClaims
      );
      const studiesByClaimId = new Map(
        claims.map((claim) => [
          claim.id,
          unique(claim.keyReferenceIds).flatMap(
            (referenceId) => studiesByReferenceId.get(referenceId) ?? []
          )
        ])
      );
      const stageId = evidenceStageFor({ claims, intervention, studiesByClaimId });
      const primaryClaim = primaryClaimForStage(claims, stageId, studiesByClaimId);
      const referenceIds = unique(primaryClaim?.keyReferenceIds ?? []);
      const references = referenceIds
        .map((referenceId) => referencesById.get(referenceId))
        .filter((reference): reference is Reference => reference !== undefined);
      const studies = referenceIds.flatMap(
        (referenceId) => studiesByReferenceId.get(referenceId) ?? []
      );
      const extractedSourceCount = primaryClaim
        ? Math.max(
            0,
            sourcePacketsByClaimId.get(primaryClaim.id)?.extractedReferenceCount ?? 0
          )
        : 0;

      return {
        intervention,
        stageId,
        primaryClaim,
        relevantClaims: claims,
        references,
        studies,
        trials: trialsByIntervention.get(intervention.id) ?? [],
        safetyAlerts: alertsByIntervention.get(intervention.id) ?? [],
        australiaStatuses: statusesByIntervention.get(intervention.id) ?? [],
        sourceCount: references.length,
        extractedSourceCount,
        confidence: primaryClaim?.confidenceLevel,
        reviewStatus: primaryClaim?.reviewStatus,
        finding: evidenceFinding(intervention, primaryClaim),
        limitation: evidenceLimitation(intervention, stageId, primaryClaim),
        lastUpdated: latestDate([
          intervention.lastReviewed,
          ...claims.map((claim) => claim.lastUpdated),
          ...(trialsByIntervention.get(intervention.id) ?? []).map(
            (trial) => trial.lastUpdateDate
          )
        ])
      };
    })
    .sort(compareRecords);

  const latestTrialUpdates = records
    .flatMap((record) =>
      record.trials.map((trial) => {
        const labels = labelTrialWatchItem(trial, record.intervention);
        return {
          intervention: record.intervention,
          trial,
          relevanceLabel: labels.trialRelevanceLabel,
          relevanceDetail: labels.trialRelevanceDetail
        };
      })
    )
    .sort((left, right) => right.trial.lastUpdateDate.localeCompare(left.trial.lastUpdateDate))
    .slice(0, 8);

  const directClaims = lifespanClaims.filter((claim) => claim.outcome === "Mortality/lifespan");
  const humanLinkedSubjects = records.filter((record) =>
    ["human-outcomes", "healthspan", "biomarkers"].includes(record.stageId)
  ).length;

  return {
    records,
    featuredRecords: selectFeaturedRecords(records, 6),
    stages: LIFESPAN_EVIDENCE_STAGES.map((stage) => ({
      ...stage,
      records: records.filter((record) => record.stageId === stage.id)
    })),
    latestTrialUpdates,
    summary: {
      trackedSubjects: records.length,
      directLifespanClaims: directClaims.length,
      lowCertaintyDirectClaims: directClaims.filter((claim) =>
        ["Low", "Very low"].includes(claim.confidenceLevel)
      ).length,
      humanLinkedSubjects,
      activeTrials: records
        .flatMap((record) => record.trials)
        .filter((trial) => ACTIVE_TRIAL_STATUSES.has(trial.status)).length
    },
    dataSource: data.dataSource,
    fallbackReason: data.fallbackReason
  };
}

function evidenceStageFor({
  claims,
  intervention,
  studiesByClaimId
}: {
  claims: Claim[];
  intervention: Intervention;
  studiesByClaimId: Map<string, Study[]>;
}): LifespanEvidenceStageId {
  if (
    claims.some(
      (claim) =>
        claim.outcome === "Mortality/lifespan" &&
        hasReviewedHumanResult(claim, studiesByClaimId)
    )
  ) {
    return "human-outcomes";
  }

  if (
    claims.some(
      (claim) => HEALTHSPAN_OUTCOMES.has(claim.outcome) && hasReviewedHumanResult(claim, studiesByClaimId)
    )
  ) {
    return "healthspan";
  }

  if (
    claims.some(
      (claim) =>
        claim.outcome === "Biological aging clocks" &&
        hasReviewedHumanResult(claim, studiesByClaimId)
    )
  ) {
    return "biomarkers";
  }

  if (
    claims.some((claim) =>
      (studiesByClaimId.get(claim.id) ?? []).some((study) =>
        PRECLINICAL_STUDY_TYPES.has(study.studyType)
      )
    )
  ) {
    return "preclinical";
  }

  if (
    intervention.category === "Drug/geroprotector watchlist" ||
    intervention.category === "Peptide/biologic"
  ) {
    return "experimental-watchlist";
  }

  return "source-leads";
}

function hasReviewedHumanResult(claim: Claim, studiesByClaimId: Map<string, Study[]>) {
  return (
    claim.reviewStatus === "Human reviewed" &&
    (studiesByClaimId.get(claim.id) ?? []).some((study) =>
      HUMAN_RESULT_STUDY_TYPES.has(study.studyType)
    )
  );
}

function primaryClaimForStage(
  claims: Claim[],
  stageId: LifespanEvidenceStageId,
  studiesByClaimId: Map<string, Study[]>
) {
  const stageClaims = claims.filter((claim) => {
    if (stageId === "human-outcomes") {
      return (
        claim.outcome === "Mortality/lifespan" &&
        hasReviewedHumanResult(claim, studiesByClaimId)
      );
    }

    if (stageId === "healthspan") {
      return HEALTHSPAN_OUTCOMES.has(claim.outcome) && hasReviewedHumanResult(claim, studiesByClaimId);
    }

    if (stageId === "biomarkers") {
      return (
        claim.outcome === "Biological aging clocks" &&
        hasReviewedHumanResult(claim, studiesByClaimId)
      );
    }

    if (stageId === "preclinical") {
      return (studiesByClaimId.get(claim.id) ?? []).some((study) =>
        PRECLINICAL_STUDY_TYPES.has(study.studyType)
      );
    }

    return CORE_LIFESPAN_OUTCOMES.has(claim.outcome);
  });

  return [...(stageClaims.length > 0 ? stageClaims : claims)].sort(compareClaims)[0];
}

function evidenceFinding(intervention: Intervention, claim?: Claim) {
  if (!claim) {
    return `${intervention.name} is tracked as a geroprotector research subject, but no direct lifespan or ageing-clock claim is established in the local catalog.`;
  }

  const summary = claim.summary?.trim() || claim.claimText.trim();

  if (/draft local claim|source leads/i.test(summary)) {
    return `${intervention.name} is tracked for ${outcomeDescription(claim)}, but the local record does not yet support a settled conclusion.`;
  }

  return firstSentence(summary);
}

function evidenceLimitation(
  intervention: Intervention,
  stageId: LifespanEvidenceStageId,
  claim?: Claim
) {
  if (stageId === "biomarkers") {
    return `A biological-age or ageing-clock change does not demonstrate that ${intervention.name} helps people live longer or remain healthier.`;
  }

  if (stageId === "healthspan") {
    return `Evidence for ${claim?.outcome.toLowerCase() ?? "a health outcome"} does not establish that ${intervention.name} extends life or broadly slows biological ageing.`;
  }

  if (stageId === "preclinical") {
    return `Animal or laboratory findings for ${intervention.name} cannot be assumed to produce the same result in people.`;
  }

  if (stageId === "experimental-watchlist") {
    return "This record is for evidence, safety, and regulatory awareness; it is not self-use guidance.";
  }

  if (stageId === "human-outcomes") {
    return `The current record does not show that ${intervention.name} extends human lifespan. Confidence is ${claim?.confidenceLevel?.toLowerCase() ?? "not assigned"}; source relevance, population, intervention form, and endpoint fit remain claim-specific.`;
  }

  return "Source relevance and structured extraction still need review before a conclusion is warranted.";
}

function compareClaims(left: Claim, right: Claim) {
  const outcomeDifference =
    Number(right.outcome === "Mortality/lifespan") - Number(left.outcome === "Mortality/lifespan");

  if (outcomeDifference !== 0) {
    return outcomeDifference;
  }

  const reviewDifference =
    Number(right.reviewStatus === "Human reviewed") -
    Number(left.reviewStatus === "Human reviewed");

  if (reviewDifference !== 0) {
    return reviewDifference;
  }

  return CONFIDENCE_PRIORITY[right.confidenceLevel] - CONFIDENCE_PRIORITY[left.confidenceLevel];
}

function compareRecords(left: LifespanEvidenceRecord, right: LifespanEvidenceRecord) {
  const stageDifference = STAGE_PRIORITY[right.stageId] - STAGE_PRIORITY[left.stageId];

  if (stageDifference !== 0) {
    return stageDifference;
  }

  const reviewDifference =
    Number(right.reviewStatus === "Human reviewed") -
    Number(left.reviewStatus === "Human reviewed");

  if (reviewDifference !== 0) {
    return reviewDifference;
  }

  const confidenceDifference =
    (right.confidence ? CONFIDENCE_PRIORITY[right.confidence] : 0) -
    (left.confidence ? CONFIDENCE_PRIORITY[left.confidence] : 0);

  if (confidenceDifference !== 0) {
    return confidenceDifference;
  }

  if (right.sourceCount !== left.sourceCount) {
    return right.sourceCount - left.sourceCount;
  }

  return left.intervention.name.localeCompare(right.intervention.name);
}

function selectFeaturedRecords(records: LifespanEvidenceRecord[], limit: number) {
  const selected: LifespanEvidenceRecord[] = [];

  for (const stage of LIFESPAN_EVIDENCE_STAGES) {
    const record = records.find((candidate) => candidate.stageId === stage.id);
    if (record) {
      selected.push(record);
    }
  }

  for (const record of records) {
    if (selected.length >= limit) {
      break;
    }

    if (!selected.includes(record)) {
      selected.push(record);
    }
  }

  return selected.slice(0, limit);
}

function latestDate(values: string[]) {
  const datedValues = values
    .map((value) => ({ time: Date.parse(value), value }))
    .filter(({ time }) => Number.isFinite(time))
    .sort((left, right) => right.time - left.time);

  return datedValues[0]?.value ?? "Not yet verified";
}

function ensureSentence(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "No plain-language finding is available yet.";
  }

  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

function firstSentence(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  const match = normalized.match(/^.*?[.!?](?:\s|$)/);
  return ensureSentence(match?.[0]?.trim() || normalized);
}

function outcomeDescription(claim: Claim) {
  if (claim.outcome === "Mortality/lifespan") {
    return "lifespan or mortality outcomes";
  }

  if (claim.outcome === "Biological aging clocks") {
    return "biological ageing markers";
  }

  return claim.outcome.toLowerCase();
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function groupBy<T>(values: T[], keyFor: (value: T) => string) {
  const grouped = new Map<string, T[]>();

  for (const value of values) {
    const key = keyFor(value);
    const group = grouped.get(key);
    if (group) {
      group.push(value);
    } else {
      grouped.set(key, [value]);
    }
  }

  return grouped;
}
