import { describe, expect, it } from "vitest";

import {
  buildClinicalTrialSourceCandidates,
  buildPubMedSourceCandidates,
  buildSourceCandidateDedupeKey
} from "@/lib/source-candidates";

describe("source candidate mapping", () => {
  it("maps PubMed triage articles into unreviewed source candidates", () => {
    const candidates = buildPubMedSourceCandidates(
      {
        query: "creatine strength",
        ids: ["28615996"],
        count: 1,
        source: "NCBI E-utilities",
        articles: [
          {
            pmid: "28615996",
            title: "Creatine position stand",
            journal: "Journal of the International Society of Sports Nutrition",
            publicationDate: "2017 Jun 13",
            publicationYear: "2017",
            publicationTypes: ["Journal Article", "Review"],
            doi: "10.1186/s12970-017-0173-z",
            hasAbstract: true,
            authors: ["Kreider RB"],
            relevanceScore: 80,
            relevanceReasons: ["Title matches query", "Review-level source"],
            url: "https://pubmed.ncbi.nlm.nih.gov/28615996/"
          }
        ]
      },
      {
        interventionId: "creatine",
        claimId: "creatine-strength",
        ingestionJobId: "job-pubmed"
      }
    );

    expect(candidates).toEqual([
      {
        dedupeKey:
          "pubmed|au|creatine%20strength|28615996|creatine|creatine-strength",
        source: "PubMed",
        externalId: "28615996",
        query: "creatine strength",
        region: "AU",
        title: "Creatine position stand",
        url: "https://pubmed.ncbi.nlm.nih.gov/28615996/",
        publishedYear: 2017,
        sourceType: "Journal Article, Review",
        abstractAvailable: true,
        triageScore: 80,
        triageReasons: ["Title matches query", "Review-level source"],
        decision: "Pending review",
        reviewStatus: "Unreviewed AI draft",
        interventionId: "creatine",
        claimId: "creatine-strength",
        ingestionJobId: "job-pubmed",
        metadata: {
          upstreamSource: "NCBI E-utilities",
          journal: "Journal of the International Society of Sports Nutrition",
          publicationDate: "2017 Jun 13",
          publicationTypes: ["Journal Article", "Review"],
          doi: "10.1186/s12970-017-0173-z",
          authors: ["Kreider RB"]
        }
      }
    ]);
  });

  it("maps ClinicalTrials.gov records into unreviewed source candidates", () => {
    const candidates = buildClinicalTrialSourceCandidates(
      {
        query: "creatine aging",
        source: "ClinicalTrials.gov API v2",
        studies: [
          {
            nctId: "NCT06606704",
            title: "Effects of Resistance-band Training and Creatine Supplementation",
            status: "Recruiting",
            phase: "Not applicable",
            studyType: "Interventional",
            enrollment: "52 estimated",
            enrollmentCount: 52,
            conditions: ["Aging"],
            interventions: ["DIETARY_SUPPLEMENT: Creatine"],
            primaryOutcomes: ["Whole-body lean mass"],
            lastUpdateDate: "2024-09-23",
            startDate: "2024-09",
            completionDate: "Unknown",
            hasResults: false,
            resultsFirstPostDate: null,
            sponsor: "Example University",
            triageScore: 80,
            triageReasons: ["Matches query context", "Active trial signal"],
            url: "https://clinicaltrials.gov/study/NCT06606704"
          }
        ]
      },
      {
        region: "AU",
        interventionId: "creatine",
        claimId: "creatine-strength"
      }
    );

    expect(candidates[0]).toMatchObject({
      dedupeKey: "clinicaltrials.gov|au|creatine%20aging|nct06606704|creatine|creatine-strength",
      source: "ClinicalTrials.gov",
      externalId: "NCT06606704",
      query: "creatine aging",
      region: "AU",
      title: "Effects of Resistance-band Training and Creatine Supplementation",
      url: "https://clinicaltrials.gov/study/NCT06606704",
      publishedYear: 2024,
      sourceType: "Interventional",
      triageScore: 80,
      triageReasons: ["Matches query context", "Active trial signal"],
      decision: "Pending review",
      reviewStatus: "Unreviewed AI draft",
      interventionId: "creatine",
      claimId: "creatine-strength"
    });
    expect(candidates[0]?.metadata).toMatchObject({
      upstreamSource: "ClinicalTrials.gov API v2",
      status: "Recruiting",
      hasResults: false,
      primaryOutcomes: ["Whole-body lean mass"]
    });
  });

  it("builds stable keys from normalized candidate identity context", () => {
    expect(
      buildSourceCandidateDedupeKey({
        source: "PubMed",
        externalId: " PMID-1 ",
        query: " Omega   3 ",
        region: " au ",
        interventionId: "omega-3"
      })
    ).toBe("pubmed|au|omega%203|pmid-1|omega-3|");
  });
});
