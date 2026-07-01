import { describe, expect, it } from "vitest";

import {
  buildScoreWorklistReferenceRepairBrief,
  buildScoreWorklistReport,
  formatScoreWorklistReferenceRepairBriefLines,
  formatScoreWorklistReportLines,
  formatScoreWorklistReportLinesWithOptions
} from "@/lib/score-worklist";
import {
  australiaRegulatoryStatuses,
  claims,
  interventions,
  productSignals,
  references,
  safetyAlerts,
  studies,
  trialWatchItems
} from "@/lib/seed-data";
import type { Claim, EvidenceDashboardData, Reference, Study } from "@/lib/types";

function seedDashboardData(): EvidenceDashboardData {
  return {
    australiaRegulatoryStatuses,
    claims,
    dataSource: "seed",
    interventions,
    productSignals,
    references,
    safetyAlerts,
    studies,
    trialWatchItems
  };
}

describe("score worklist", () => {
  it("builds a read-only scoring run sheet with suggestions and linked citations", () => {
    const data = seedDashboardData();
    const sourceBackedClaim = data.claims.find((claim) => claim.keyReferenceIds.length > 0);

    expect(sourceBackedClaim).toBeDefined();

    const readyClaim: Claim = {
      ...sourceBackedClaim!,
      evidenceGrade: "Insufficient until source packets are reviewed.",
      id: "score-ready-test"
    };
    const report = buildScoreWorklistReport(
      {
        ...data,
        claims: [readyClaim]
      },
      { limit: 5 }
    );

    expect(report.summary.readyToScore).toBe(1);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({
      claimId: "score-ready-test",
      disposition: "score-now",
      state: "ready_to_score"
    });
    expect(report.rows[0].suggestion.compositeScore).toBeGreaterThan(0);
    expect(report.rows[0].suggestion.limitations.join(" ")).toContain("Operator");
    expect(report.rows[0].references.length).toBeGreaterThan(0);
    expect(report.rows[0].sourcePacket.studies.length).toBeGreaterThan(0);
    expect(report.rows[0].claim.claimText).toBe(readyClaim.claimText);
  });

  it("formats and filters the local score worklist", () => {
    const data = seedDashboardData();
    const sourceBackedClaim = data.claims.find((claim) => claim.keyReferenceIds.length > 0)!;
    const defaultLookingClaim: Claim = {
      ...sourceBackedClaim,
      evidenceGrade: "Starter score review fixture",
      id: "default-score-test",
      scores: {
        effectSize: 3,
        evidenceDirectness: 3,
        evidenceRigor: 3,
        hypePenalty: 7,
        measurability: 3,
        productQuality: 4,
        regulatoryRisk: 7,
        safety: 4
      }
    };
    const report = buildScoreWorklistReport(
      {
        ...data,
        claims: [defaultLookingClaim]
      },
      {
        state: "default_score_review"
      }
    );
    const lines = formatScoreWorklistReportLines(report).join("\n");

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].currentScoreLabel).toContain("3.1 Weak");
    expect(lines).toContain("Read-only local score worklist");
    expect(lines).toContain("Default-looking score");
    expect(lines).toContain("Operator: Open /operator > Score tools");
  });

  it("orders ready scoring work before source-blocked extraction by default", () => {
    const data = seedDashboardData();
    const sourceBackedClaim = data.claims.find((claim) => claim.keyReferenceIds.length > 0);

    expect(sourceBackedClaim).toBeDefined();

    const readyClaim: Claim = {
      ...sourceBackedClaim!,
      evidenceGrade: "Insufficient until source packets are reviewed.",
      id: "ready-score-first"
    };
    const sourceBlockedClaim: Claim = {
      ...sourceBackedClaim!,
      finalLabel: "Core Evidence-Based",
      id: "source-blocked-second",
      keyReferenceIds: ["missing-reference-for-score-worklist-order"],
      scores: {
        effectSize: 9,
        evidenceDirectness: 9,
        evidenceRigor: 9,
        hypePenalty: 1,
        measurability: 9,
        productQuality: 8,
        regulatoryRisk: 1,
        safety: 9
      }
    };
    const report = buildScoreWorklistReport(
      {
        ...data,
        claims: [sourceBlockedClaim, readyClaim]
      },
      { limit: 2 }
    );

    expect(report.rows.map((row) => [row.claimId, row.state])).toEqual([
      ["ready-score-first", "ready_to_score"],
      ["source-blocked-second", "source_blocked"]
    ]);
    const lines = formatScoreWorklistReportLines(report).join("\n");
    expect(lines).toContain("Order: score-review and ready-to-score rows first");
    expect(lines).toContain("Repair blockers: Missing source record 1.");
    expect(lines).toContain(
      "Repair lanes: 0 extraction-ready reference group(s), 0 identity-check reference group(s), 1 missing-source row(s), 0 unlinked claim row(s)."
    );
  });

  it("formats detailed scoring review context without writing scores", () => {
    const data = seedDashboardData();
    const sourceBackedClaim = data.claims.find((claim) => claim.keyReferenceIds.length > 0)!;
    const readyClaim: Claim = {
      ...sourceBackedClaim,
      evidenceGrade: "Insufficient until source packets are reviewed.",
      id: "detailed-score-row"
    };
    const report = buildScoreWorklistReport(
      {
        ...data,
        claims: [readyClaim]
      },
      { limit: 1 }
    );
    const lines = formatScoreWorklistReportLinesWithOptions(report, { detail: true }).join("\n");

    expect(lines).toContain("Claim:");
    expect(lines).toContain("Boundary:");
    expect(lines).toContain("Source packet:");
    expect(lines).toContain("Study 1:");
    expect(lines).toContain("What would change score:");
  });

  it("groups source-blocked rows by pending extraction reference", () => {
    const data = seedDashboardData();
    const sourceBackedClaim = data.claims.find((claim) => claim.keyReferenceIds.length > 0)!;
    const sharedPendingReference: Reference = {
      id: "shared-pending-score-reference",
      identifier: "PMID:12345678",
      source: "PubMed",
      title: "Creatine shared source that still needs extraction",
      url: "https://pubmed.ncbi.nlm.nih.gov/12345678/",
      year: 2026
    };
    const firstBlockedClaim: Claim = {
      ...sourceBackedClaim,
      id: "blocked-score-first",
      keyReferenceIds: [sharedPendingReference.id]
    };
    const secondBlockedClaim: Claim = {
      ...sourceBackedClaim,
      id: "blocked-score-second",
      keyReferenceIds: [sharedPendingReference.id],
      outcome: "Safety/adverse effects"
    };
    const report = buildScoreWorklistReport(
      {
        ...data,
        claims: [firstBlockedClaim, secondBlockedClaim],
        references: [...data.references, sharedPendingReference]
      },
      {
        state: "source_blocked"
      }
    );
    const lines = formatScoreWorklistReportLinesWithOptions(report, {
      repairSummary: true
    }).join("\n");

    expect(report.repairSummary.sourceBlockedRows).toBe(2);
    expect(report.repairSummary.extractionPendingRows).toBe(2);
    expect(report.repairSummary.extractionReadyReferenceGroups).toBe(1);
    expect(report.repairSummary.extractionReadyReferenceClaimLinks).toBe(2);
    expect(report.repairSummary.identityWarningReferenceGroups).toBe(0);
    expect(report.repairSummary.identityWarningReferenceClaimLinks).toBe(0);
    expect(report.summary.sourceBlockers).toMatchObject({
      extraction_pending: 2,
      missing_sources: 0,
      not_linked: 0
    });
    expect(report.repairSummary.blockerBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          claimCount: 2,
          kind: "missing-structured-extraction",
          label: "Missing structured extraction"
        }),
        expect.objectContaining({
          claimCount: 2,
          kind: "claim-support-gap",
          label: "Claim-support gap"
        })
      ])
    );
    expect(report.repairSummary.pendingReferenceGroups[0]).toMatchObject({
      claimCount: 2,
      extractionGaps: expect.arrayContaining([
        { claimCount: 2, gap: "source type" },
        { claimCount: 2, gap: "sample size/results status" },
        { claimCount: 2, gap: "population fit" },
        { claimCount: 2, gap: "intervention fit" },
        { claimCount: 2, gap: "adverse events/tolerability" },
        { claimCount: 2, gap: "funding/conflicts" },
        { claimCount: 2, gap: "risk of bias/evidence quality" },
        {
          claimCount: 1,
          gap: `claim-relevant ${firstBlockedClaim.outcome} outcomes/result direction`
        },
        {
          claimCount: 1,
          gap: `claim-relevant ${secondBlockedClaim.outcome} outcomes/result direction`
        }
      ]),
      reference: {
        id: sharedPendingReference.id,
        label: "PubMed PMID:12345678 2026"
      }
    });
    expect(report.repairSummary.extractionBatchGroups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          claimCount: 1,
          claimLinks: 1,
          outcome: firstBlockedClaim.outcome,
          referenceCount: 1,
          sampleReferences: [
            expect.objectContaining({
              id: sharedPendingReference.id,
              sourceTypeHint: "unknown; verify source type before writing extraction"
            })
          ]
        }),
        expect.objectContaining({
          claimCount: 1,
          claimLinks: 1,
          outcome: secondBlockedClaim.outcome,
          referenceCount: 1
        })
      ])
    );
    expect(lines).toContain("Source repair summary");
    expect(lines).toContain(
      "Extraction lanes: 1 reference group(s) / 2 claim-link(s) can move to extraction; 0 reference group(s) / 0 claim-link(s) need identity cleanup first."
    );
    expect(lines).toContain("Top extraction batches:");
    expect(lines).toContain("First brief: npx tsx scripts/local-score-worklist.ts --repair-reference shared-pending-score-reference");
    expect(lines).toContain("Source-blocked scoring rows: 2 (extraction pending 2)");
    expect(lines).toContain("Blocker types (rows can appear in more than one type):");
    expect(lines).toContain(
      "- Missing structured extraction: 2 claim row(s). Extract study/source fields before assigning dimension scores."
    );
    expect(lines).toContain("Top extraction-ready references");
    expect(lines).toContain("unlocks 2 claim(s)");
    expect(lines).toContain(
      "Gaps: source type (2); sample size/results status (2); population fit (2)"
    );
    expect(lines).toContain(
      "Brief: npx tsx scripts/local-score-worklist.ts --repair-reference shared-pending-score-reference"
    );
    expect(lines).toContain("blocked-score-first");
    expect(lines).toContain("blocked-score-second");
  });

  it("prioritizes source repair groups by highest blocked claim before batch size", () => {
    const data = seedDashboardData();
    const sourceBackedClaim = data.claims.find((claim) => claim.keyReferenceIds.length > 0)!;
    const highPriorityReference: Reference = {
      id: "high-priority-pending-score-reference",
      identifier: "PMID:99990001",
      source: "PubMed",
      title: "High-priority source that blocks a public score",
      url: "https://pubmed.ncbi.nlm.nih.gov/99990001/",
      year: 2026
    };
    const sharedLowPriorityReference: Reference = {
      id: "shared-low-priority-score-reference",
      identifier: "PMID:99990002",
      source: "PubMed",
      title: "Shared lower-priority source that blocks two rows",
      url: "https://pubmed.ncbi.nlm.nih.gov/99990002/",
      year: 2026
    };
    const highPriorityClaim: Claim = {
      ...sourceBackedClaim,
      finalLabel: "Core Evidence-Based",
      id: "high-priority-blocked-score",
      keyReferenceIds: [highPriorityReference.id],
      scores: {
        effectSize: 9,
        evidenceDirectness: 9,
        evidenceRigor: 9,
        hypePenalty: 1,
        measurability: 9,
        productQuality: 8,
        regulatoryRisk: 1,
        safety: 9
      }
    };
    const lowPriorityClaimA: Claim = {
      ...sourceBackedClaim,
      finalLabel: "Insufficient Evidence",
      id: "low-priority-blocked-score-a",
      keyReferenceIds: [sharedLowPriorityReference.id],
      scores: {
        effectSize: 1,
        evidenceDirectness: 1,
        evidenceRigor: 1,
        hypePenalty: 8,
        measurability: 2,
        productQuality: 2,
        regulatoryRisk: 8,
        safety: 3
      }
    };
    const lowPriorityClaimB: Claim = {
      ...lowPriorityClaimA,
      id: "low-priority-blocked-score-b",
      outcome: "Safety/adverse effects"
    };
    const report = buildScoreWorklistReport(
      {
        ...data,
        claims: [lowPriorityClaimA, lowPriorityClaimB, highPriorityClaim],
        references: [...data.references, highPriorityReference, sharedLowPriorityReference]
      },
      {
        state: "source_blocked"
      }
    );

    expect(report.repairSummary.pendingReferenceGroups.map((group) => group.reference.id)).toEqual([
      highPriorityReference.id,
      sharedLowPriorityReference.id
    ]);
    expect(report.repairSummary.pendingReferenceGroups[0].claimCount).toBe(1);
    expect(report.repairSummary.pendingReferenceGroups[1].claimCount).toBe(2);
    expect(report.repairSummary.pendingReferenceGroups[0].highestPriority).toBeGreaterThan(
      report.repairSummary.pendingReferenceGroups[1].highestPriority
    );
  });

  it("warns when pending extraction references do not visibly mention the target intervention", () => {
    const data = seedDashboardData();
    const creatineClaim = data.claims.find((claim) => claim.id === "creatine-strength")!;
    const mismatchReference: Reference = {
      id: "creatine-mismatch-pending-reference",
      identifier: "PMID:99990003",
      source: "PubMed",
      title: "Effects of pre-exercise vibration training on muscle soreness",
      url: "https://pubmed.ncbi.nlm.nih.gov/99990003/",
      year: 2026
    };
    const matchingReference: Reference = {
      id: "creatine-visible-pending-reference",
      identifier: "PMID:99990004",
      source: "PubMed",
      title: "Creatine supplementation during resistance training",
      url: "https://pubmed.ncbi.nlm.nih.gov/99990004/",
      year: 2026
    };
    const mismatchClaim: Claim = {
      ...creatineClaim,
      id: "creatine-mismatch-blocked-score",
      keyReferenceIds: [mismatchReference.id]
    };
    const matchingClaim: Claim = {
      ...creatineClaim,
      id: "creatine-visible-blocked-score",
      keyReferenceIds: [matchingReference.id]
    };
    const report = buildScoreWorklistReport(
      {
        ...data,
        claims: [mismatchClaim, matchingClaim],
        references: [...data.references, mismatchReference, matchingReference]
      },
      {
        state: "source_blocked"
      }
    );
    const mismatchGroup = report.repairSummary.pendingReferenceGroups.find(
      (group) => group.reference.id === mismatchReference.id
    );
    const matchingGroup = report.repairSummary.pendingReferenceGroups.find(
      (group) => group.reference.id === matchingReference.id
    );
    const lines = formatScoreWorklistReportLinesWithOptions(report, {
      repairSummary: true
    }).join("\n");
    const focusedLines = formatScoreWorklistReportLinesWithOptions(report, {
      repairIdentityWarningsOnly: true,
      repairSummary: true
    }).join("\n");
    const briefLines = formatScoreWorklistReferenceRepairBriefLines(
      buildScoreWorklistReferenceRepairBrief(
        {
          ...data,
          claims: [mismatchClaim],
          references: [...data.references, mismatchReference]
        },
        mismatchReference.id
      )
    ).join("\n");

    expect(mismatchGroup?.identityWarnings).toEqual([
      "Reference title does not visibly mention Creatine monohydrate; verify accepted candidate identity before extracting this as claim evidence."
    ]);
    expect(matchingGroup?.identityWarnings).toEqual([]);
    expect(report.repairSummary.identityWarningReferenceGroups).toBe(1);
    expect(report.repairSummary.identityWarningReferenceClaimLinks).toBe(1);
    expect(report.repairSummary.extractionReadyReferenceGroups).toBe(1);
    expect(report.repairSummary.extractionReadyReferenceClaimLinks).toBe(1);
    expect(report.repairSummary.blockerBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          claimCount: 1,
          kind: "identity-mismatch",
          label: "Identity mismatch"
        })
      ])
    );
    expect(lines).toContain("Identity warning: Reference title does not visibly mention");
    expect(lines).toContain("identity-warning references: 1");
    expect(lines).toContain(
      "Extraction lanes: 1 reference group(s) / 1 claim-link(s) can move to extraction; 1 reference group(s) / 1 claim-link(s) need identity cleanup first."
    );
    expect(lines).toContain("Top extraction-ready references:");
    expect(lines).toContain("Identity cleanup lane:");
    expect(lines).toContain("Cleanup preview: npx tsx scripts/local-score-worklist.ts");
    expect(focusedLines).toContain(
      "Top pending extraction references with identity warnings:"
    );
    expect(focusedLines).toContain(mismatchReference.id);
    expect(focusedLines).not.toContain(matchingReference.id);
    expect(briefLines).toContain("Identity warnings:");
    expect(briefLines).toContain("Identity cleanup first:");
    expect(briefLines).toContain("Use the local Candidate Review identity resolver");
    expect(briefLines).toContain("--repair-identity-action actionable");
    expect(briefLines).toContain("removes the accepted candidate's claim-reference link");
    expect(briefLines).toContain("Resolve accepted-candidate identity first");
  });

  it("uses intervention synonyms and common forms before raising identity warnings", () => {
    const data = seedDashboardData();
    const vitaminDClaim = data.claims.find((claim) => claim.interventionId === "vitamin-d")!;
    const omegaClaim = data.claims.find((claim) => claim.interventionId === "omega-3")!;
    const vitaminD3Reference: Reference = {
      id: "vitamin-d3-visible-pending-reference",
      identifier: "PMID:99990005",
      source: "PubMed",
      title: "Vitamin D3 supplementation in adults with low 25(OH)D",
      url: "https://pubmed.ncbi.nlm.nih.gov/99990005/",
      year: 2026
    };
    const n3Reference: Reference = {
      id: "n3-visible-pending-reference",
      identifier: "PMID:99990006",
      source: "PubMed",
      title: "N-3 fatty acid supplementation and lipid profile outcomes",
      url: "https://pubmed.ncbi.nlm.nih.gov/99990006/",
      year: 2026
    };
    const report = buildScoreWorklistReport(
      {
        ...data,
        claims: [
          {
            ...vitaminDClaim,
            id: "vitamin-d3-visible-blocked-score",
            keyReferenceIds: [vitaminD3Reference.id]
          },
          {
            ...omegaClaim,
            id: "n3-visible-blocked-score",
            keyReferenceIds: [n3Reference.id]
          }
        ],
        references: [...data.references, vitaminD3Reference, n3Reference]
      },
      {
        state: "source_blocked"
      }
    );

    expect(
      report.repairSummary.pendingReferenceGroups.find(
        (group) => group.reference.id === vitaminD3Reference.id
      )?.identityWarnings
    ).toEqual([]);
    expect(
      report.repairSummary.pendingReferenceGroups.find(
        (group) => group.reference.id === n3Reference.id
      )?.identityWarnings
    ).toEqual([]);
  });

  it("builds a read-only extraction brief for one source-blocking reference", () => {
    const data = seedDashboardData();
    const sourceBackedClaim = data.claims.find((claim) => claim.keyReferenceIds.length > 0)!;
    const sourceBackedIntervention = data.interventions.find(
      (intervention) => intervention.id === sourceBackedClaim.interventionId
    )!;
    const sharedPendingReference: Reference = {
      id: "brief-pending-score-reference",
      identifier: "PMID:87654321",
      source: "PubMed",
      title: `${sourceBackedIntervention.name} systematic review and meta-analysis that still needs extraction`,
      url: "https://pubmed.ncbi.nlm.nih.gov/87654321/",
      year: 2026
    };
    const blockedClaim: Claim = {
      ...sourceBackedClaim,
      id: "brief-blocked-score",
      keyReferenceIds: [sharedPendingReference.id]
    };
    const brief = buildScoreWorklistReferenceRepairBrief(
      {
        ...data,
        claims: [blockedClaim],
        references: [...data.references, sharedPendingReference]
      },
      sharedPendingReference.id
    );
    const lines = formatScoreWorklistReferenceRepairBriefLines(brief).join("\n");

    expect(brief.reference?.label).toBe("PubMed PMID:87654321 2026");
    expect(brief.totalAffectedClaims).toBe(1);
    expect(brief.identityCleanupActions).toEqual([]);
    expect(brief.nextActions).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Verify source type and citation identity"),
        expect.stringContaining("Add structured extraction"),
        expect.stringContaining("local-score-worklist.ts --state ready_to_score"),
        expect.stringContaining("local-score-draft.ts --limit 15")
      ])
    );
    expect(brief.affectedClaims[0]).toMatchObject({
      claimId: "brief-blocked-score",
      extractionGaps: expect.arrayContaining([
        "source type",
        "sample size/results status",
        "population fit",
        "intervention fit",
        `claim-relevant ${blockedClaim.outcome} outcomes/result direction`,
        "adverse events/tolerability",
        "funding/conflicts",
        "risk of bias/evidence quality"
      ]),
      sourcePacketLabel: "Extraction pending"
    });
    expect(brief.sourceTypeHint).toContain("meta-analysis");
    expect(lines).toContain("Read-only score source repair brief");
    expect(lines).toContain("Affected claims:");
    expect(lines).toContain("Extraction gaps: source type; sample size/results status");
    expect(lines).toContain("Existing study rows for this reference: none.");
    expect(lines).toContain("Repair sequence:");
    expect(lines).toContain("local-score-worklist.ts --state ready_to_score");
    expect(lines).toContain("local-score-draft.ts --limit 15");
    expect(lines).toContain("Extraction checklist:");
    expect(lines).toContain("Write guardrails:");
  });

  it("names placeholder extraction fields when a partial study row still blocks scoring", () => {
    const data = seedDashboardData();
    const sourceBackedClaim = data.claims.find((claim) => claim.keyReferenceIds.length > 0)!;
    const pendingReference: Reference = {
      id: "brief-partial-score-reference",
      identifier: "PMID:22223333",
      source: "PubMed",
      title: "Randomized trial with incomplete extraction",
      url: "https://pubmed.ncbi.nlm.nih.gov/22223333/",
      year: 2026
    };
    const blockedClaim: Claim = {
      ...sourceBackedClaim,
      id: "brief-partial-blocked-score",
      keyReferenceIds: [pendingReference.id]
    };
    const partialStudy: Study = {
      adverseEvents: "Not extracted yet.",
      fundingConflicts: "Not extracted.",
      id: "partial-study-row",
      intervention: "Intervention matched to the source.",
      outcomes: ["Strength improved versus comparator."],
      population: "Adults in a randomized trial.",
      referenceId: pendingReference.id,
      riskOfBias: "Not extracted.",
      sampleSize: "120 participants.",
      source: "PubMed",
      studyType: "Randomized controlled trial",
      title: "Randomized trial with incomplete extraction",
      year: 2026
    };
    const brief = buildScoreWorklistReferenceRepairBrief(
      {
        ...data,
        claims: [blockedClaim],
        references: [...data.references, pendingReference],
        studies: [...data.studies, partialStudy]
      },
      pendingReference.id
    );
    const lines = formatScoreWorklistReferenceRepairBriefLines(brief).join("\n");

    expect(brief.totalAffectedClaims).toBe(1);
    expect(brief.affectedClaims[0].extractionGaps).toEqual([
      "adverse events/tolerability",
      "funding/conflicts",
      "risk of bias/evidence quality"
    ]);
    expect(lines).toContain(
      "Extraction gaps: adverse events/tolerability; funding/conflicts; risk of bias/evidence quality"
    );
    expect(lines).toContain("Existing study rows for this reference:");
    expect(lines).toContain("Safety: Not extracted yet.");
  });
});
