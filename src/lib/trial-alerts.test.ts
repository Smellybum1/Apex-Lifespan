import {
  TrialAlertKind as DbTrialAlertKind,
  TrialAlertStatus as DbTrialAlertStatus
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import { buildClinicalTrialAlertDrafts } from "@/lib/trial-alerts";

describe("buildClinicalTrialAlertDrafts", () => {
  it("maps ClinicalTrials.gov alert labels into no-auto-promotion draft rows", () => {
    const detectedAt = new Date("2026-06-13T10:00:00.000Z");
    const drafts = buildClinicalTrialAlertDrafts(
      {
        query: "creatine",
        source: "ClinicalTrials.gov API v2",
        studies: [
          {
            briefSummary: "Registry summary.",
            completionDate: "2026-01-01",
            conditions: ["Strength"],
            enrollment: "120 actual",
            enrollmentCount: 120,
            hasResults: true,
            interventions: ["DIETARY_SUPPLEMENT: Creatine"],
            lastUpdateDate: "2026-02-01",
            nctId: "NCT123",
            phase: "Not applicable",
            primaryOutcomes: ["Strength"],
            resultsFirstPostDate: "2026-03-01",
            sponsor: "Example University",
            startDate: "2025-01-01",
            status: "Completed",
            studyType: "Interventional",
            title: "Creatine trial with posted results",
            trialAlertDetail:
              "Posted registry results are an operator review alert. Do not change public scores until outcomes are extracted, citation-linked, and human-reviewed.",
            trialAlertLabel: "Results review needed",
            trialRelevanceDetail:
              "The query intervention appears in the registered intervention metadata.",
            trialRelevanceLabel: "Direct match",
            trialResultDetail: "Results are posted.",
            trialResultLabel: "Results posted",
            triageReasons: ["Results posted"],
            triageScore: 100,
            url: "https://clinicaltrials.gov/study/NCT123"
          }
        ]
      },
      {
        claimId: "creatine-strength",
        detectedAt,
        interventionId: "creatine",
        sourceCandidateIdByNctId: new Map([["NCT123", "candidate-1"]]),
        trialIdByNctId: new Map([["NCT123", "trial-1"]])
      }
    );

    expect(drafts).toEqual([
      {
        data: expect.objectContaining({
          claim: {
            connect: {
              id: "creatine-strength"
            }
          },
          detectedAt,
          intervention: {
            connect: {
              id: "creatine"
            }
          },
          kind: DbTrialAlertKind.RESULTS_REVIEW_NEEDED,
          nctId: "NCT123",
          noAutoPromotion: true,
          sourceCandidate: {
            connect: {
              id: "candidate-1"
            }
          },
          status: DbTrialAlertStatus.OPEN,
          title: "Creatine trial with posted results",
          trial: {
            connect: {
              id: "trial-1"
            }
          }
        }),
        nctId: "NCT123"
      }
    ]);
    expect(drafts[0]?.data).not.toHaveProperty("scoreHistory");
    expect(drafts[0]?.data.metadata).toMatchObject({
      query: "creatine",
      relevanceLabel: "Direct match",
      resultLabel: "Results posted",
      triageScore: 100
    });
  });

  it("keeps unknown NCT identifiers out of optional persistence keys", () => {
    const [draft] = buildClinicalTrialAlertDrafts({
      query: "omega-3",
      source: "ClinicalTrials.gov API v2",
      studies: [
        {
          completionDate: "Unknown",
          conditions: [],
          enrollment: "Not provided",
          enrollmentCount: null,
          hasResults: false,
          interventions: [],
          lastUpdateDate: "Unknown",
          nctId: "Unknown NCT",
          phase: "Not provided",
          primaryOutcomes: [],
          resultsFirstPostDate: null,
          sponsor: null,
          startDate: "Unknown",
          status: "Unknown",
          studyType: "Unknown",
          title: "Untitled study",
          trialAlertDetail: "Low-priority lead.",
          trialAlertLabel: "Low-priority lead",
          trialRelevanceDetail: "Needs review.",
          trialRelevanceLabel: "Unreviewed lead",
          trialResultDetail: "Needs review.",
          trialResultLabel: "Unreviewed lead",
          triageReasons: ["Needs manual trial review"],
          triageScore: 20,
          url: "https://clinicaltrials.gov/"
        }
      ]
    });

    expect(draft?.data).toMatchObject({
      kind: DbTrialAlertKind.LOW_PRIORITY_LEAD,
      noAutoPromotion: true,
      status: DbTrialAlertStatus.OPEN
    });
    expect(draft?.data.nctId).toBeUndefined();
  });
});
