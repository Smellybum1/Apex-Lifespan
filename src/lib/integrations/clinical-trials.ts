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
  lastUpdateDate: string;
  startDate: string;
  completionDate: string;
  hasResults: boolean;
  resultsFirstPostDate: string | null;
  sponsor: string | null;
  triageScore: number;
  triageReasons: string[];
  url: string;
}

export interface ClinicalTrialSearchResult {
  query: string;
  studies: ClinicalTrialSearchItem[];
  source: string;
}

const LIVE_SOURCE_FETCH_INIT = {
  headers: {
    accept: "application/json"
  },
  cache: "no-store"
} satisfies RequestInit;

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

  const response = await fetch(url, LIVE_SOURCE_FETCH_INIT);

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
  const nctId = protocol?.identificationModule?.nctId ?? "Unknown NCT";
  const conditions = stringArray(protocol?.conditionsModule?.conditions);
  const interventions = clinicalTrialInterventionLabels(
    protocol?.armsInterventionsModule?.interventions
  );
  const primaryOutcomes = clinicalTrialOutcomeLabels(
    protocol?.outcomesModule?.primaryOutcomes
  );
  const phases = stringArray(protocol?.designModule?.phases);
  const enrollmentCount = readNumber(protocol?.designModule?.enrollmentInfo?.count);
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
        : `${enrollmentCount.toLocaleString()}${protocol?.designModule?.enrollmentInfo?.type ? ` ${protocol.designModule.enrollmentInfo.type.toLowerCase()}` : ""}`,
    enrollmentCount,
    conditions,
    interventions,
    primaryOutcomes,
    lastUpdateDate: protocol?.statusModule?.lastUpdatePostDateStruct?.date ?? "Unknown",
    startDate: protocol?.statusModule?.startDateStruct?.date ?? "Unknown",
    completionDate:
      protocol?.statusModule?.primaryCompletionDateStruct?.date ??
      protocol?.statusModule?.completionDateStruct?.date ??
      "Unknown",
    hasResults,
    resultsFirstPostDate: protocol?.statusModule?.resultsFirstPostDateStruct?.date ?? null,
    sponsor: firstText(protocol?.sponsorCollaboratorsModule?.leadSponsor?.name),
    triageScore: 0,
    triageReasons: [],
    url: nctId === "Unknown NCT" ? "https://clinicaltrials.gov/" : `https://clinicaltrials.gov/study/${nctId}`
  };
  const triage = triageClinicalTrial(item, term);

  return {
    ...item,
    triageScore: triage.score,
    triageReasons: triage.reasons
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

function normalisePageSize(pageSize: number) {
  if (!Number.isFinite(pageSize)) {
    return 10;
  }

  return Math.min(Math.max(Math.trunc(pageSize), 1), 20);
}

function readableStatus(value?: string) {
  if (!value) {
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

  if (labels[value]) {
    return labels[value];
  }

  return value
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
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringArray(values: unknown) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.filter((value): value is string => typeof value === "string" && value.length > 0);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && !Array.isArray(value) && typeof value === "object";
}
