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
        worklistContext={{
          "creatine-strength": {
            nextAction:
              "Use the complete source packet to assign dimension scores, final label, and uncertainty language.",
            priorityLabel: "High",
            reasons: ["Ready to score", "source packet complete", "review-level source extracted"],
            state: "ready_to_score",
            stateLabel: "Ready to score"
          }
        }}
      />
    );

    expect(html).toContain("Score field editor");
    expect(html).toContain("Batch review summary");
    expect(html).toContain("Score contract");
    expect(html).toContain("Formula weights");
    expect(html).toContain("Directness");
    expect(html).toContain("22%");
    expect(html).toContain("Product caveat context");
    expect(html).toContain("Label override reminder");
    expect(html).toContain("Final labels");
    expect(html).toContain("Direct score rows");
    expect(html).toContain("Source-blocked");
    expect(html).toContain("Guardrail labels");
    expect(html).toContain("Suggested labels:");
    expect(html).toContain("Useful for Specific Use Case 1");
    expect(html).toContain("Score bands:");
    expect(html).toContain("Moderate 1");
    expect(html).toContain("current 8.2 Strong");
    expect(html).toContain("preview 7.4 Moderate");
    expect(html).toContain("Preview:");
    expect(html).toContain("7.4 / 10, Moderate band");
    expect(html).toContain("Draft differs from saved score");
    expect(html).toContain("Draft changes");
    expect(html).toContain("Directness: 9 -&gt; 8");
    expect(html).toContain("Effect size: 8 -&gt; 6");
    expect(html).toContain("Regulatory risk: 2 -&gt; 4");
    expect(html).toContain("Composite weight: 22%");
    expect(html).toContain("Composite weight: 10%; lower raw risk improves the visible score.");
    expect(html).toContain("Tracked as caveat context; not a direct composite weight.");
    expect(html).toContain("Review checklist");
    expect(html).toContain("Verify each cited source supports the scoped claim");
    expect(html).toContain("Do not mark Human reviewed unless a human explicitly confirms the score");
    expect(html).toContain("no medical advice");
    expect(html).toContain("Suggested scoring");
    expect(html).toContain("Use suggestion");
    expect(html).toContain("Use current");
    expect(html).toContain("Strongest linked study type: Meta-analysis.");
    expect(html).toContain("Ready to score");
    expect(html).toContain("High priority");
    expect(html).toContain("Use the complete source packet");
    expect(html).toContain("Source packet");
    expect(html).toContain("Complete");
    expect(html).toContain("Extraction coverage");
    expect(html).toContain("1/1 citation(s) extracted");
    expect(html).toContain("Creatine review");
    expect(html).toContain("Extracted study context");
    expect(html).toContain("Meta-analysis 2017 - Creatine meta-analysis");
    expect(html).toContain("Population:");
    expect(html).toContain("Outcomes:");
    expect(html).toContain("Operator draft score update");
    expect(html).toContain("Product-level AU/TGA clearance is not inferred");
    expect(html).toContain("Apply score update");
  });

  it("keeps source-blocked rows dry-run only until extraction is complete", () => {
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
            status: "extraction_pending"
          }
        ]}
        studies={[]}
        updateAction={vi.fn()}
        worklistContext={{
          "creatine-strength": {
            nextAction:
              "Add structured extraction for the pending references before treating this packet as complete.",
            priorityLabel: "High",
            reasons: ["Source-blocked", "Extraction pending"],
            state: "source_blocked",
            stateLabel: "Source-blocked"
          }
        }}
      />
    );

    expect(html).toContain("Source-blocked");
    expect(html).toContain("Complete source extraction or source linking");
    expect(html).toContain("Apply waits for ready-to-score or score-review work");
    expect(html).toContain("Extraction pending");
    expect(html).toContain("0/1 citation(s) extracted");
    expect(html).toContain("preview 8.2 Strong");
    expect(html).toContain("No extracted study rows are visible");
    expect(html).not.toContain("Apply score update");
    expect(html).not.toContain("Draft differs from saved score");
    expect(html).not.toContain("Draft changes");
    expect(html).not.toContain("Review checklist");
    expect(html).toContain("disabled");
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
