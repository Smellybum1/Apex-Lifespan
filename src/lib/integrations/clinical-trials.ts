import {
  fetchLiveSource,
  LIVE_SOURCE_JSON_FETCH_INIT
} from "@/lib/live-source-fetch";

export interface ClinicalTrialSearchItem {
  nctId: string;
  title: string;
  status: string;
  phase: string;
  studyType: string;
  enrollment: string;
  enrollmentCount: number | null;
  conditions: string[];
  interventions: string[];
  primaryOutcomes: string[];
  briefSummary?: string;
  lastUpdateDate: string;
  startDate: string;
  completionDate: string;
  hasResults: boolean;
  resultsFirstPostDate: string | null;
  sponsor: string | null;
  trialRelevanceDetail: string;
  trialRelevanceLabel: ClinicalTrialRelevanceLabel;
  trialResultDetail: string;
  trialResultLabel: ClinicalTrialResultLabel;
  triageScore: number;
  triageReasons: string[];
  url: string;
}

export type ClinicalTrialRelevanceLabel =
  | "Combination product"
  | "Direct match"
  | "Related outcome only"
  | "Unreviewed lead"
  | "Wrong population";

export type ClinicalTrialResultLabel =
  | "Completed, no results posted"
  | "Results posted"
  | "Terminated/unknown"
  | "Unreviewed lead";

export interface ClinicalTrialSearchResult {
  query: string;
  studies: ClinicalTrialSearchItem[];
  source: string;
}

interface ClinicalTrialsApiStudy {
  protocolSection?: {
    identificationModule?: {
      nctId?: string;
      briefTitle?: string;
      officialTitle?: string;
    };
    statusModule?: {
      overallStatus?: string;
      startDateStruct?: {
        date?: string;
      };
      primaryCompletionDateStruct?: {
        date?: string;
      };
      completionDateStruct?: {
        date?: string;
      };
      lastUpdatePostDateStruct?: {
        date?: string;
      };
      resultsFirstPostDateStruct?: {
        date?: string;
      };
    };
    designModule?: {
      phases?: string[];
      studyType?: string;
      enrollmentInfo?: {
        count?: number;
        type?: string;
      };
    };
    conditionsModule?: {
      conditions?: string[];
    };
    descriptionModule?: {
      briefSummary?: string;
    };
    armsInterventionsModule?: {
      interventions?: Array<{
        type?: string;
        name?: string;
      }>;
    };
    outcomesModule?: {
      primaryOutcomes?: Array<{
        measure?: string;
      }>;
    };
    sponsorCollaboratorsModule?: {
      leadSponsor?: {
        name?: string;
      };
    };
  };
  resultsSection?: unknown;
}

export async function searchClinicalTrials(
  term: string,
  pageSize = 10
): Promise<ClinicalTrialSearchResult> {
  const url = new URL("https://clinicaltrials.gov/api/v2/studies");
  const safePageSize = normalisePageSize(pageSize);
  url.searchParams.set("query.term", term);
  url.searchParams.set("pageSize", String(safePageSize));

  const response = await fetchLiveSource(
    "ClinicalTrials.gov",
    url,
    LIVE_SOURCE_JSON_FETCH_INIT
  );

  if (!response.ok) {
    throw new Error(`ClinicalTrials.gov search failed with ${response.status}`);
  }

  const data = (await response.json()) as {
    studies?: unknown;
  };

  const studies = readClinicalTrialStudies(data.studies)
    .slice(0, safePageSize)
    .map((study) => mapClinicalTrialStudy(study, term));

  return {
    query: term,
    studies,
    source: "ClinicalTrials.gov API v2"
  };
}

function mapClinicalTrialStudy(
  study: ClinicalTrialsApiStudy,
  term: string
): ClinicalTrialSearchItem {
  const protocol = study.protocolSection;
  const nctId = firstText(protocol?.identificationModule?.nctId) ?? "Unknown NCT";
  const conditions = stringArray(protocol?.conditionsModule?.conditions);
  const interventions = clinicalTrialInterventionLabels(
    protocol?.armsInterventionsModule?.interventions
  );
  const primaryOutcomes = clinicalTrialOutcomeLabels(
    protocol?.outcomesModule?.primaryOutcomes
  );
  const phases = stringArray(protocol?.designModule?.phases);
  const enrollmentCount = readNumber(protocol?.designModule?.enrollmentInfo?.count);
  const enrollmentType = firstText(protocol?.designModule?.enrollmentInfo?.type);
  const hasResults = Boolean(protocol?.statusModule?.resultsFirstPostDateStruct || study.resultsSection);
  const item = {
    nctId,
    title:
      firstText(
        protocol?.identificationModule?.briefTitle,
        protocol?.identificationModule?.officialTitle
      ) ?? "Untitled study",
    status: readableStatus(protocol?.statusModule?.overallStatus),
    phase: phases.length > 0 ? phases.map(readableStatus).join(", ") : "Not provided",
    studyType: readableStatus(protocol?.designModule?.studyType),
    enrollment:
      enrollmentCount === null
        ? "Not provided"
        : `${enrollmentCount.toLocaleString()}${enrollmentType ? ` ${enrollmentType.toLowerCase()}` : ""}`,
    enrollmentCount,
    conditions,
    interventions,
    primaryOutcomes,
    briefSummary: firstText(protocol?.descriptionModule?.briefSummary) ?? undefined,
    lastUpdateDate: firstText(protocol?.statusModule?.lastUpdatePostDateStruct?.date) ?? "Unknown",
    startDate: firstText(protocol?.statusModule?.startDateStruct?.date) ?? "Unknown",
    completionDate:
      firstText(
        protocol?.statusModule?.primaryCompletionDateStruct?.date,
        protocol?.statusModule?.completionDateStruct?.date
      ) ??
      "Unknown",
    hasResults,
    resultsFirstPostDate: firstText(protocol?.statusModule?.resultsFirstPostDateStruct?.date),
    sponsor: firstText(protocol?.sponsorCollaboratorsModule?.leadSponsor?.name),
    trialRelevanceDetail: "Trial relevance needs manual review against the scoped claim.",
    trialRelevanceLabel: "Unreviewed lead" as const,
    trialResultDetail: "Registry status needs manual review before treating this as evidence.",
    trialResultLabel: "Unreviewed lead" as const,
    triageScore: 0,
    triageReasons: [],
    url: nctId === "Unknown NCT" ? "https://clinicaltrials.gov/" : `https://clinicaltrials.gov/study/${nctId}`
  };
  const relevance = classifyClinicalTrialRelevance(item, term);
  const resultStatus = classifyClinicalTrialResultStatus(item);
  const labelledItem = {
    ...item,
    ...relevance,
    ...resultStatus
  };
  const triage = triageClinicalTrial(labelledItem, term);

  return {
    ...labelledItem,
    triageScore: triage.score,
    triageReasons: triage.reasons
  };
}

function classifyClinicalTrialRelevance(
  item: Pick<
    ClinicalTrialSearchItem,
    "briefSummary" | "conditions" | "interventions" | "primaryOutcomes" | "title"
  >,
  term: string
): Pick<ClinicalTrialSearchItem, "trialRelevanceDetail" | "trialRelevanceLabel"> {
  const tokens = meaningfulQueryTokens(term);
  const populationText = [
    item.title,
    item.briefSummary ?? "",
    ...item.conditions
  ].join(" ");
  const interventionMatches = valuesContainQueryTokens(item.interventions, tokens);
  const titleMatches = valuesContainQueryTokens([item.title], tokens);
  const outcomeMatches = valuesContainQueryTokens(
    [...item.conditions, ...item.primaryOutcomes],
    tokens
  );

  if (hasWrongPopulationSignal(populationText)) {
    return {
      trialRelevanceDetail:
        "Registry title, condition, or summary metadata suggests a population that may not match the public adult supplement claim; review before using.",
      trialRelevanceLabel: "Wrong population"
    };
  }

  if (interventionMatches && hasCombinationProductSignal(item.interventions, tokens)) {
    return {
      trialRelevanceDetail:
        "The query intervention appears with another non-control intervention or combination wording; isolate product/form before interpreting.",
      trialRelevanceLabel: "Combination product"
    };
  }

  if (interventionMatches) {
    return {
      trialRelevanceDetail:
        "The query intervention appears in the registered intervention metadata; still confirm dose, form, comparator, and outcome.",
      trialRelevanceLabel: "Direct match"
    };
  }

  if (outcomeMatches) {
    return {
      trialRelevanceDetail:
        "The query appears in condition or outcome metadata, but not as a registered intervention match.",
      trialRelevanceLabel: "Related outcome only"
    };
  }

  if (titleMatches) {
    return {
      trialRelevanceDetail:
        "The title matches the search term, but intervention and outcome metadata do not yet confirm claim relevance.",
      trialRelevanceLabel: "Unreviewed lead"
    };
  }

  return {
    trialRelevanceDetail:
      "ClinicalTrials.gov metadata does not yet show a direct intervention, outcome, or population match; inspect manually before use.",
    trialRelevanceLabel: "Unreviewed lead"
  };
}

function classifyClinicalTrialResultStatus(
  item: Pick<ClinicalTrialSearchItem, "hasResults" | "status">
): Pick<ClinicalTrialSearchItem, "trialResultDetail" | "trialResultLabel"> {
  const status = item.status.toLowerCase();

  if (item.hasResults) {
    return {
      trialResultDetail:
        "ClinicalTrials.gov indicates posted results or a results section is available; inspect the record before interpreting outcomes.",
      trialResultLabel: "Results posted"
    };
  }

  if (status === "completed") {
    return {
      trialResultDetail:
        "The registry status is completed, but no posted results were detected in the public metadata.",
      trialResultLabel: "Completed, no results posted"
    };
  }

  if (
    status.includes("terminated") ||
    status.includes("withdrawn") ||
    status.includes("suspended") ||
    status.includes("unknown")
  ) {
    return {
      trialResultDetail:
        "The registry status is terminated, suspended, withdrawn, or unknown; treat this as a weak lead until reviewed.",
      trialResultLabel: "Terminated/unknown"
    };
  }

  return {
    trialResultDetail:
      "The record is not completed with posted results in the captured metadata; treat as an unreviewed registry lead.",
    trialResultLabel: "Unreviewed lead"
  };
}

function triageClinicalTrial(item: ClinicalTrialSearchItem, term: string) {
  const reasons: string[] = [];
  let score = 20;
  const searchable = [
    item.title,
    ...item.conditions,
    ...item.interventions,
    ...item.primaryOutcomes
  ]
    .join(" ")
    .toLowerCase();
  const queryTokens = term
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2);

  if (queryTokens.some((token) => searchable.includes(token))) {
    score += 20;
    reasons.push("Matches query context");
  }

  if (item.status === "Recruiting" || item.status === "Active, not recruiting") {
    score += 15;
    reasons.push("Active trial signal");
  }

  if (item.status === "Completed") {
    score += 10;
    reasons.push("Completed trial");
  }

  if (item.hasResults) {
    score += 20;
    reasons.push("Results posted");
  }

  if (item.studyType === "Interventional") {
    score += 15;
    reasons.push("Interventional design");
  }

  if (item.phase !== "Not provided") {
    score += 10;
    reasons.push("Phase reported");
  }

  if (item.enrollmentCount !== null && item.enrollmentCount >= 100) {
    score += 10;
    reasons.push("Larger enrollment");
  }

  return {
    score: Math.min(score, 100),
    reasons: reasons.length > 0 ? reasons : ["Needs manual trial review"]
  };
}

function meaningfulQueryTokens(term: string) {
  const stopWords = new Set([
    "and",
    "for",
    "in",
    "of",
    "or",
    "outcome",
    "study",
    "the",
    "trial",
    "with"
  ]);

  return Array.from(
    new Set(
      term
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 3 && !stopWords.has(token))
    )
  );
}

function valuesContainQueryTokens(values: string[], tokens: string[]) {
  if (tokens.length === 0) {
    return false;
  }

  const text = values.join(" ").toLowerCase();
  return tokens.some((token) => text.includes(token));
}

function hasCombinationProductSignal(interventions: string[], tokens: string[]) {
  const nonControlInterventions = interventions.filter(
    (intervention) => !/\b(placebo|control|standard care|usual care)\b/i.test(intervention)
  );
  const matchingInterventions = nonControlInterventions.filter((intervention) =>
    valuesContainQueryTokens([intervention], tokens)
  );
  const matchingText = matchingInterventions.join(" ").toLowerCase();

  return (
    matchingInterventions.length > 0 &&
    (nonControlInterventions.length > 1 ||
      /\b(adjunct|coadministered|co-administered|combination|combined|plus|with)\b/.test(
        matchingText
      ) ||
      /[+/]/.test(matchingText))
  );
}

function hasWrongPopulationSignal(value: string) {
  return /\b(adolescent|animal|canine|child|children|infant|juvenile|mice|mouse|murine|neonate|paediatric|pediatric|pregnancy|pregnant|rat|rats|veterinary)\b/i.test(
    value
  );
}

function normalisePageSize(pageSize: number) {
  if (!Number.isFinite(pageSize)) {
    return 10;
  }

  return Math.min(Math.max(Math.trunc(pageSize), 1), 20);
}

function readableStatus(value?: string) {
  const normalised = firstText(value);

  if (!normalised) {
    return "Unknown";
  }

  const labels: Record<string, string> = {
    ACTIVE_NOT_RECRUITING: "Active, not recruiting",
    NOT_YET_RECRUITING: "Not yet recruiting",
    ENROLLING_BY_INVITATION: "Enrolling by invitation",
    EARLY_PHASE1: "Early Phase 1",
    PHASE1: "Phase 1",
    PHASE2: "Phase 2",
    PHASE3: "Phase 3",
    PHASE4: "Phase 4",
    NA: "Not applicable"
  };

  if (labels[normalised]) {
    return labels[normalised];
  }

  return normalised
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const trimmed = value.trim();

    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return null;
}

function readNumber(value: unknown) {
  if (typeof value === "string") {
    const text = firstText(value);

    if (!text) {
      return null;
    }

    const numberValue = Number(text);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  const numberValue = typeof value === "number" ? value : null;

  return numberValue !== null && Number.isFinite(numberValue) ? numberValue : null;
}

function stringArray(values: unknown) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.flatMap((value) => {
    const text = firstText(value);
    return text ? [text] : [];
  });
}

function readClinicalTrialStudies(values: unknown): ClinicalTrialsApiStudy[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.filter(isClinicalTrialsApiStudy);
}

function clinicalTrialInterventionLabels(values: unknown) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.flatMap((value) => {
    if (!isRecord(value)) {
      return [];
    }

    const label = [firstText(value.type), firstText(value.name)].filter(Boolean).join(": ");
    return label ? [label] : [];
  });
}

function clinicalTrialOutcomeLabels(values: unknown) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.flatMap((value) => {
    if (!isRecord(value)) {
      return [];
    }

    const measure = firstText(value.measure);
    return measure ? [measure] : [];
  });
}

function isClinicalTrialsApiStudy(value: unknown): value is ClinicalTrialsApiStudy {
  return isRecord(value);
}

export function labelTrialRegistryRecord(
  record: {
    briefSummary?: string;
    conditions?: string[];
    hasResults?: boolean;
    registeredInterventions?: string[];
    primaryOutcomes?: string[];
    status: string;
    title: string;
  },
  searchTerm: string
) {
  return {
    ...classifyClinicalTrialRelevance(
      {
        briefSummary: record.briefSummary ?? "",
        conditions: record.conditions ?? [],
        interventions: record.registeredInterventions ?? [],
        primaryOutcomes: record.primaryOutcomes ?? [],
        title: record.title
      },
      searchTerm
    ),
    ...classifyClinicalTrialResultStatus({
      hasResults: record.hasResults ?? false,
      status: record.status
    })
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && !Array.isArray(value) && typeof value === "object";
}
