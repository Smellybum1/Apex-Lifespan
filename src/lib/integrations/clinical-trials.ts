export interface ClinicalTrialSearchItem {
  nctId: string;
  title: string;
  status: string;
  phase: string;
  lastUpdateDate: string;
  url: string;
}

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
    };
    statusModule?: {
      overallStatus?: string;
      lastUpdatePostDateStruct?: {
        date?: string;
      };
    };
    designModule?: {
      phases?: string[];
    };
  };
}

export async function searchClinicalTrials(
  term: string,
  pageSize = 10
): Promise<ClinicalTrialSearchResult> {
  const url = new URL("https://clinicaltrials.gov/api/v2/studies");
  url.searchParams.set("query.term", term);
  url.searchParams.set("pageSize", String(pageSize));

  const response = await fetch(url, {
    headers: {
      accept: "application/json"
    },
    next: {
      revalidate: 60 * 60
    }
  });

  if (!response.ok) {
    throw new Error(`ClinicalTrials.gov search failed with ${response.status}`);
  }

  const data = (await response.json()) as {
    studies?: ClinicalTrialsApiStudy[];
  };

  const studies = (data.studies ?? []).map((study) => {
    const protocol = study.protocolSection;
    const nctId = protocol?.identificationModule?.nctId ?? "Unknown NCT";

    return {
      nctId,
      title: protocol?.identificationModule?.briefTitle ?? "Untitled study",
      status: protocol?.statusModule?.overallStatus ?? "Unknown",
      phase: protocol?.designModule?.phases?.join(", ") ?? "Not provided",
      lastUpdateDate: protocol?.statusModule?.lastUpdatePostDateStruct?.date ?? "Unknown",
      url: nctId === "Unknown NCT" ? "https://clinicaltrials.gov/" : `https://clinicaltrials.gov/study/${nctId}`
    };
  });

  return {
    query: term,
    studies,
    source: "ClinicalTrials.gov API v2"
  };
}
