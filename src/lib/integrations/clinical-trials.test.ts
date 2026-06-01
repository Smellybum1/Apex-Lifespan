import { afterEach, describe, expect, it, vi } from "vitest";

import { searchClinicalTrials } from "@/lib/integrations/clinical-trials";

describe("searchClinicalTrials", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns trial triage metadata from ClinicalTrials.gov v2 records", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({
        studies: [
          {
            protocolSection: {
              identificationModule: {
                nctId: "NCT123",
                briefTitle: "Omega-3 randomized cardiovascular trial"
              },
              statusModule: {
                overallStatus: "COMPLETED",
                startDateStruct: { date: "2024-01" },
                primaryCompletionDateStruct: { date: "2025-02" },
                lastUpdatePostDateStruct: { date: "2025-03-01" },
                resultsFirstPostDateStruct: { date: "2025-04-01" }
              },
              designModule: {
                studyType: "INTERVENTIONAL",
                phases: ["PHASE4"],
                enrollmentInfo: { count: 240, type: "ACTUAL" }
              },
              conditionsModule: {
                conditions: ["Hypertriglyceridemia"]
              },
              armsInterventionsModule: {
                interventions: [{ type: "DRUG", name: "Omega-3 fatty acids" }]
              },
              outcomesModule: {
                primaryOutcomes: [{ measure: "Triglyceride change" }]
              },
              sponsorCollaboratorsModule: {
                leadSponsor: { name: "Example University" }
              }
            }
          }
        ]
      })
    );

    const result = await searchClinicalTrials("omega-3");

    expect(result.source).toBe("ClinicalTrials.gov API v2");
    expect(result.studies).toEqual([
      {
        nctId: "NCT123",
        title: "Omega-3 randomized cardiovascular trial",
        status: "Completed",
        phase: "Phase 4",
        studyType: "Interventional",
        enrollment: "240 actual",
        enrollmentCount: 240,
        conditions: ["Hypertriglyceridemia"],
        interventions: ["DRUG: Omega-3 fatty acids"],
        primaryOutcomes: ["Triglyceride change"],
        lastUpdateDate: "2025-03-01",
        startDate: "2024-01",
        completionDate: "2025-02",
        hasResults: true,
        resultsFirstPostDate: "2025-04-01",
        sponsor: "Example University",
        triageScore: 100,
        triageReasons: [
          "Matches query context",
          "Completed trial",
          "Results posted",
          "Interventional design",
          "Phase reported",
          "Larger enrollment"
        ],
        url: "https://clinicaltrials.gov/study/NCT123"
      }
    ]);
  });

  it("uses safe fallbacks when optional modules are absent", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({
        studies: [{ protocolSection: { identificationModule: { nctId: "NCT999" } } }]
      })
    );

    const result = await searchClinicalTrials("creatine");

    expect(result.studies[0]).toMatchObject({
      nctId: "NCT999",
      title: "Untitled study",
      status: "Unknown",
      phase: "Not provided",
      studyType: "Unknown",
      enrollment: "Not provided",
      conditions: [],
      interventions: [],
      primaryOutcomes: [],
      hasResults: false,
      triageReasons: ["Needs manual trial review"]
    });
  });

  it("caps pageSize to keep public searches bounded", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({ studies: [] })
    );

    await searchClinicalTrials("omega-3", 500);

    const url = new URL(String(fetchSpy.mock.calls[0]?.[0]));
    expect(url.searchParams.get("pageSize")).toBe("20");
  });
});

function jsonResponse(body: unknown) {
  return {
    ok: true,
    json: async () => body
  } as Response;
}
