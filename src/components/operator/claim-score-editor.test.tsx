import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { OperatorClaimScoreEditor } from "@/components/operator/claim-score-editor";
import type { Claim, Reference, Study } from "@/lib/types";

describe("OperatorClaimScoreEditor", () => {
  it("renders score preview and linked source packet context", () => {
    const html = renderToStaticMarkup(
      <OperatorClaimScoreEditor
        applyEnabled={true}
        claimReferences={{
          "creatine-strength": [reference]
        }}
        claims={[claim]}
        sourcePackets={[
          {
            claimId: "creatine-strength",
            current: true,
            referenceIds: ["ref-creatine"],
            reviewStatus: "Unreviewed AI draft",
            sourcePacketId: "packet-1",
            status: "complete"
          }
        ]}
        studies={[study]}
        updateAction={vi.fn()}
      />
    );

    expect(html).toContain("Score field editor");
    expect(html).toContain("current 8.2 Strong");
    expect(html).toContain("Preview:");
    expect(html).toContain("Suggested scoring");
    expect(html).toContain("Use suggestion");
    expect(html).toContain("Strongest linked study type: Meta-analysis.");
    expect(html).toContain("Source packet");
    expect(html).toContain("Complete");
    expect(html).toContain("Creatine review");
    expect(html).toContain("Apply score update");
  });
});

const claim: Claim = {
  applicabilityNotes: "Resistance-trained adults.",
  claimText: "Creatine monohydrate can support high-intensity strength performance.",
  clinicalRelevance: "Useful for training outcomes.",
  comparator: "Placebo",
  confidenceLevel: "High",
  doseFormStudied: "Creatine monohydrate",
  durationStudied: "4-12 weeks",
  effectSize: "Moderate",
  evidenceGrade: "A",
  finalLabel: "Useful for Specific Use Case",
  id: "creatine-strength",
  interventionId: "creatine",
  keyReferenceIds: ["ref-creatine"],
  lastUpdated: "2026-07-01",
  momentum: "Stable",
  outcome: "Muscle/strength",
  populationStudied: "Adults",
  reviewStatus: "Unreviewed AI draft",
  safetyNotes: "Generally well tolerated in studied adults.",
  scores: {
    effectSize: 8,
    evidenceDirectness: 9,
    evidenceRigor: 8,
    hypePenalty: 2,
    measurability: 7,
    productQuality: 6,
    regulatoryRisk: 2,
    safety: 8
  },
  whatWouldChangeScore: "New contradictory evidence."
};

const reference: Reference = {
  id: "ref-creatine",
  identifier: "PMID:28615996",
  source: "PubMed",
  title: "Creatine review",
  url: "https://pubmed.ncbi.nlm.nih.gov/28615996/",
  year: 2017
};

const study: Study = {
  adverseEvents: "No serious adverse events reported.",
  fundingConflicts: "Not extracted.",
  id: "study-creatine",
  intervention: "Creatine monohydrate",
  outcomes: ["Strength"],
  population: "Adults",
  referenceId: "ref-creatine",
  riskOfBias: "Low",
  sampleSize: "Meta-analysis",
  source: "PubMed",
  studyType: "Meta-analysis",
  title: "Creatine meta-analysis",
  year: 2017
};
