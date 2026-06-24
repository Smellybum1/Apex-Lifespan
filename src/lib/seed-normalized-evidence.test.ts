import { describe, expect, it } from "vitest";

import { claims, references, studies } from "@/lib/seed-data";
import {
  assertSeedNormalizedEvidenceRows,
  buildSeedNormalizedEvidenceRows,
  findSeedNormalizedEvidenceIntegrityIssues,
  rehydrateSeedNormalizedEvidenceRowsFromPersistedRows,
  seedClaimScoreSnapshotId,
  seedClaimStudyKey,
  seedSourcePacketId,
  seedSourcePacketReferenceKey,
  type PersistedEvidenceLabel,
  type PersistedSeedNormalizedEvidenceRows,
  type PersistedReviewStatus,
  type SeedNormalizedEvidenceRows
} from "@/lib/seed-normalized-evidence";
import { findSeedIntegrityIssues } from "@/lib/seed-integrity";

describe("buildSeedNormalizedEvidenceRows", () => {
  it("builds deterministic source packets and references for every seeded claim", () => {
    const rows = buildSeedNormalizedEvidenceRows({ claims, studies });

    expect(rows.sourcePackets).toHaveLength(claims.length);
    expect(rows.sourcePackets.find((packet) => packet.claimId === "creatine-strength"))
      .toMatchObject({
        id: seedSourcePacketId("creatine-strength"),
        interventionId: "creatine",
        reviewStatus: "AI reviewed",
        status: "COMPLETE"
      });
    expect(
      rows.sourcePacketReferences
        .filter((reference) => reference.sourcePacketId === seedSourcePacketId("creatine-strength"))
        .map((reference) => reference.referenceId)
    ).toEqual(["ref-pubmed-42141930", "issn-creatine-2017"]);
    expect(
      rows.sourcePacketReferences.every(
        (reference) => reference.extractionStatus === "Complete"
      )
    ).toBe(true);
  });

  it("keeps normalized source-packet references aligned with claim key references", () => {
    const rows = buildSeedNormalizedEvidenceRows({ claims, studies });
    const expectedKeys = claims.flatMap((claim) =>
      claim.keyReferenceIds.map((referenceId) =>
        `${seedSourcePacketId(claim.id)}:${referenceId}`
      )
    );

    expect(
      rows.sourcePacketReferences.map(seedSourcePacketReferenceKey).sort()
    ).toEqual(expectedKeys.sort());
    expect(
      findSeedIntegrityIssues([
        {
          name: "SourcePacketReference",
          expectedIds: expectedKeys,
          actualIds: rows.sourcePacketReferences.map(seedSourcePacketReferenceKey)
        }
      ])
    ).toEqual([]);
  });

  it("backfills claim-study relation rows from extracted study references", () => {
    const rows = buildSeedNormalizedEvidenceRows({ claims, studies });
    const studiesByReferenceId = new Map<string, string[]>();

    studies.forEach((study) => {
      studiesByReferenceId.set(study.referenceId, [
        ...(studiesByReferenceId.get(study.referenceId) ?? []),
        study.id
      ]);
    });

    const expectedKeys = claims.flatMap((claim) =>
      claim.keyReferenceIds.flatMap((referenceId) =>
        (studiesByReferenceId.get(referenceId) ?? []).map(
          (studyId) => `${claim.id}:${studyId}`
        )
      )
    );

    expect(rows.claimStudies.map(seedClaimStudyKey).sort()).toEqual(expectedKeys.sort());
    expect(rows.claimStudies.map(seedClaimStudyKey)).toEqual(
      expect.arrayContaining([
        "dietary-nitrate-beetroot-blood-pressure:study-benjamim-beetroot-bp-2022",
        "dietary-nitrate-beetroot-endurance:study-mcmahon-nitrate-endurance-2017",
        "dietary-nitrate-beetroot-endurance:study-ais-dietary-nitrate-beetroot",
        "dietary-nitrate-beetroot-safety:study-ais-dietary-nitrate-beetroot",
        "dietary-nitrate-beetroot-safety:study-benjamim-beetroot-bp-2022",
        "sodium-bicarbonate-high-intensity-performance:study-issn-sodium-bicarbonate-2021",
        "sodium-bicarbonate-high-intensity-performance:study-ais-sodium-bicarbonate",
        "sodium-bicarbonate-safety:study-ods-exercise-performance-sodium-bicarbonate",
        "sodium-bicarbonate-safety:study-ais-sodium-bicarbonate",
        "vitamin-c-immune-respiratory:study-hemila-vitamin-c-common-cold-2013",
        "vitamin-c-immune-respiratory:study-hemila-vitamin-c-cold-severity-2023",
        "vitamin-c-safety:study-ods-vitamin-c-safety",
        "resveratrol-glucose-insulin-hba1c:study-resveratrol-t2d-meta-2021",
        "resveratrol-lifespan:study-semba-resveratrol-mortality-2014",
        "resveratrol-safety:study-livertox-resveratrol",
        "resveratrol-safety:study-resveratrol-drug-interactions-2012",
        "quercetin-blood-pressure-biomarkers:study-huang-quercetin-cardiometabolic-2020",
        "quercetin-blood-pressure-biomarkers:study-serban-quercetin-bp-2016",
        "quercetin-safety:study-livertox-quercetin",
        "quercetin-safety:study-andres-quercetin-safety-2018",
        "fisetin-senolytic-lifespan:study-yousefzadeh-fisetin-senotherapeutic-2018",
        "fisetin-senolytic-lifespan:study-fisetin-senotherapeutic-review-2024",
        "fisetin-senolytic-lifespan:study-ctgov-fisetin-vascular-aging-nct06133634",
        "fisetin-safety:study-fisetin-senotherapeutic-review-2024",
        "fisetin-safety:study-ctgov-fisetin-safety-pk-nct06431932",
        "fisetin-safety:study-ctgov-fisetin-oa-nct04210986"
      ])
    );
    expect(
      rows.claimStudies
        .filter((row) => row.claimId === "bpc-157-injury-healing")
        .map((row) => row.relation)
    ).toEqual(["SAFETY_REGULATORY", "SAFETY_REGULATORY"]);
    expect(
      rows.claimStudies.find((row) => row.claimId === "creatine-strength")?.relation
    ).toBe("SUPPORTS");
  });

  it("creates score snapshots using the same composite formula as the public dashboard", () => {
    const rows = buildSeedNormalizedEvidenceRows({ claims, studies });
    const creatineSnapshot = rows.scoreSnapshots.find(
      (snapshot) => snapshot.claimId === "creatine-strength"
    );
    const bpcSnapshot = rows.scoreSnapshots.find(
      (snapshot) => snapshot.claimId === "bpc-157-injury-healing"
    );

    expect(rows.scoreSnapshots).toHaveLength(claims.length);
    expect(creatineSnapshot).toMatchObject({
      compositeScore: 8.4,
      finalLabel: "Core Evidence-Based",
      id: seedClaimScoreSnapshotId("creatine-strength"),
      reviewStatus: "AI reviewed",
      scoreVersion: "v1"
    });
    expect(bpcSnapshot).toMatchObject({
      compositeScore: 1.8,
      finalLabel: "Regulatory Concern",
      id: seedClaimScoreSnapshotId("bpc-157-injury-healing")
    });
  });

  it("passes the normalized evidence integrity preflight for the seeded import rows", () => {
    const rows = buildSeedNormalizedEvidenceRows({ claims, studies });

    expect(
      findSeedNormalizedEvidenceIntegrityIssues({ claims, references, rows, studies })
    ).toEqual([]);
    expect(() =>
      assertSeedNormalizedEvidenceRows({ claims, references, rows, studies })
    ).not.toThrow();
  });

  it("reports normalized evidence import drift before database writes", () => {
    const rows = buildSeedNormalizedEvidenceRows({ claims, studies });
    const duplicateSnapshot = rows.scoreSnapshots.find(
      (snapshot) => snapshot.claimId === "creatine-strength"
    );

    expect(duplicateSnapshot).toBeDefined();

    const issues = findSeedNormalizedEvidenceIntegrityIssues({
      claims,
      references,
      studies,
      rows: {
        ...rows,
        claimStudies: rows.claimStudies.filter(
          (row) => row.claimId !== "creatine-strength"
        ),
        scoreSnapshots: [...rows.scoreSnapshots, duplicateSnapshot!],
        sourcePacketReferences: [
          ...rows.sourcePacketReferences,
          {
            ...rows.sourcePacketReferences.find(
              (reference) => reference.referenceId === "ref-pubmed-42141930"
            )!,
            sourcePacketId: "seed-source-packet-retired-claim"
          }
        ],
        sourcePackets: rows.sourcePackets.filter(
          (packet) => packet.claimId !== "creatine-strength"
        )
      }
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          missingIds: [seedSourcePacketId("creatine-strength")],
          name: "Normalized SourcePacket"
        }),
        expect.objectContaining({
          missingIds: [
            "creatine-strength:study-creatine-issn",
            "creatine-strength:study-pubmed-42141930-creatine-strength"
          ],
          name: "Normalized ClaimStudy"
        }),
        expect.objectContaining({
          duplicateActualIds: [seedClaimScoreSnapshotId("creatine-strength")],
          name: "Normalized ClaimScoreSnapshot"
        }),
        expect.objectContaining({
          name: "Normalized SourcePacketReference",
          staleSeedOwnedIds: [
            "seed-source-packet-retired-claim:ref-pubmed-42141930"
          ]
        })
      ])
    );
  });

  it("reports normalized evidence value drift before database writes", () => {
    const rows = buildSeedNormalizedEvidenceRows({ claims, studies });

    const issues = findSeedNormalizedEvidenceIntegrityIssues({
      claims,
      references,
      studies,
      rows: {
        ...rows,
        claimStudies: rows.claimStudies.map((row) =>
          row.claimId === "creatine-strength"
            ? { ...row, relevanceScore: 1 }
            : row
        ),
        scoreSnapshots: rows.scoreSnapshots.map((snapshot) =>
          snapshot.claimId === "creatine-strength"
            ? {
                ...snapshot,
                compositeScore: 1,
                scores: {
                  ...snapshot.scores,
                  evidenceRigor: 1
                }
              }
            : snapshot
        ),
        sourcePacketReferences: rows.sourcePacketReferences.map((reference) =>
          reference.referenceId === "issn-creatine-2017"
            ? { ...reference, extractionStatus: "Extraction pending" }
            : reference
        ),
        sourcePackets: rows.sourcePackets.map((packet) =>
          packet.claimId === "creatine-strength"
            ? { ...packet, status: "NOT_LINKED" }
            : packet
        )
      }
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          missingIds: expect.arrayContaining([
            expect.stringContaining("claimId=creatine-strength")
          ]),
          name: "Normalized SourcePacket state"
        }),
        expect.objectContaining({
          missingIds: expect.arrayContaining([
            expect.stringContaining(
              `sourcePacketId=${seedSourcePacketId("creatine-strength")}`
            )
          ]),
          name: "Normalized SourcePacketReference state"
        }),
        expect.objectContaining({
          missingIds: expect.arrayContaining([
            expect.stringContaining("claimId=creatine-strength")
          ]),
          name: "Normalized ClaimStudy values"
        }),
        expect.objectContaining({
          missingIds: expect.arrayContaining([
            expect.stringContaining("claimId=creatine-strength")
          ]),
          name: "Normalized ClaimScoreSnapshot values"
        })
      ])
    );
  });

  it("rehydrates persisted seed-owned normalized rows for post-seed verification", () => {
    const rows = buildSeedNormalizedEvidenceRows({ claims, studies });
    const persistedRows = persistedRowsFromSeedRows(rows);

    const rehydratedRows = rehydrateSeedNormalizedEvidenceRowsFromPersistedRows({
      expectedRows: rows,
      persistedRows: {
        ...persistedRows,
        claimStudies: [
          ...persistedRows.claimStudies,
          {
            claimId: "operator-reviewed-claim",
            note: "Operator row outside seed ownership.",
            relation: "SUPPORTS",
            relevanceScore: 5,
            studyId: "operator-reviewed-study"
          },
          {
            claimId: "creatine-strength",
            note: "Operator row outside seed ownership.",
            relation: "SUPPORTS",
            relevanceScore: 5,
            studyId: "operator-reviewed-study"
          }
        ],
        scoreSnapshots: [
          ...persistedRows.scoreSnapshots,
          {
            ...persistedRows.scoreSnapshots[0]!,
            id: "operator-score-snapshot-1"
          }
        ],
        sourcePacketReferences: [
          ...persistedRows.sourcePacketReferences,
          {
            ...persistedRows.sourcePacketReferences[0]!,
            sourcePacketId: "operator-source-packet-1"
          }
        ],
        sourcePackets: [
          ...persistedRows.sourcePackets,
          {
            ...persistedRows.sourcePackets[0]!,
            id: "operator-source-packet-1"
          }
        ]
      }
    });

    expect(rehydratedRows).toEqual(rows);
    expect(
      findSeedNormalizedEvidenceIntegrityIssues({
        claims,
        references,
        rows: rehydratedRows,
        studies
      })
    ).toEqual([]);
  });

  it("reports stale persisted seed-owned claim-study links after seed writes", () => {
    const rows = buildSeedNormalizedEvidenceRows({ claims, studies });
    const persistedRows = persistedRowsFromSeedRows(rows);
    const staleClaimStudyKey = "creatine-strength:study-stale-seed-owned";

    const rehydratedRows = rehydrateSeedNormalizedEvidenceRowsFromPersistedRows({
      expectedRows: rows,
      persistedRows: {
        ...persistedRows,
        claimStudies: [
          ...persistedRows.claimStudies,
          {
            claimId: "creatine-strength",
            note: "Seed relevance backfill from claim source packet.",
            relation: "SUPPORTS",
            relevanceScore: 8,
            studyId: "study-stale-seed-owned"
          }
        ]
      }
    });

    const issues = findSeedNormalizedEvidenceIntegrityIssues({
      claims,
      references,
      rows: rehydratedRows,
      studies
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Normalized ClaimStudy",
          staleSeedOwnedIds: [staleClaimStudyKey]
        })
      ])
    );
  });

  it("reports persisted normalized evidence value drift after seed writes", () => {
    const rows = buildSeedNormalizedEvidenceRows({ claims, studies });
    const persistedRows = persistedRowsFromSeedRows(rows);

    const rehydratedRows = rehydrateSeedNormalizedEvidenceRowsFromPersistedRows({
      expectedRows: rows,
      persistedRows: {
        ...persistedRows,
        claimStudies: persistedRows.claimStudies.map((row) =>
          row.claimId === "creatine-strength"
            ? { ...row, relevanceScore: 1 }
            : row
        ),
        scoreSnapshots: persistedRows.scoreSnapshots.map((snapshot) =>
          snapshot.claimId === "creatine-strength"
            ? {
                ...snapshot,
                compositeScore: "1.00",
                evidenceRigorScore: 1
              }
            : snapshot
        ),
        sourcePacketReferences: persistedRows.sourcePacketReferences.map((reference) =>
          reference.referenceId === "issn-creatine-2017"
            ? { ...reference, extractionStatus: "Extraction pending" }
            : reference
        ),
        sourcePackets: persistedRows.sourcePackets.map((packet) =>
          packet.claimId === "creatine-strength"
            ? { ...packet, status: "NOT_LINKED" }
            : packet
        )
      }
    });

    const issues = findSeedNormalizedEvidenceIntegrityIssues({
      claims,
      references,
      rows: rehydratedRows,
      studies
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          missingIds: expect.arrayContaining([
            expect.stringContaining("claimId=creatine-strength")
          ]),
          name: "Normalized SourcePacket state"
        }),
        expect.objectContaining({
          missingIds: expect.arrayContaining([
            expect.stringContaining(
              `sourcePacketId=${seedSourcePacketId("creatine-strength")}`
            )
          ]),
          name: "Normalized SourcePacketReference state"
        }),
        expect.objectContaining({
          missingIds: expect.arrayContaining([
            expect.stringContaining("claimId=creatine-strength")
          ]),
          name: "Normalized ClaimStudy values"
        }),
        expect.objectContaining({
          missingIds: expect.arrayContaining([
            expect.stringContaining("claimId=creatine-strength")
          ]),
          name: "Normalized ClaimScoreSnapshot values"
        })
      ])
    );
  });
});

function persistedRowsFromSeedRows(
  rows: SeedNormalizedEvidenceRows
): PersistedSeedNormalizedEvidenceRows {
  return {
    claimStudies: rows.claimStudies.map((row) => ({ ...row })),
    scoreSnapshots: rows.scoreSnapshots.map((snapshot) => ({
      claimId: snapshot.claimId,
      compositeScore: snapshot.compositeScore.toString(),
      computedAt: new Date(`${snapshot.computedAt}T00:00:00.000Z`),
      effectSizeScore: snapshot.scores.effectSize,
      evidenceDirectnessScore: snapshot.scores.evidenceDirectness,
      evidenceRigorScore: snapshot.scores.evidenceRigor,
      finalLabel: persistedEvidenceLabel(snapshot.finalLabel),
      hypePenalty: snapshot.scores.hypePenalty,
      id: snapshot.id,
      measurabilityScore: snapshot.scores.measurability,
      productQualityScore: snapshot.scores.productQuality,
      rationale: snapshot.rationale,
      regulatoryRiskScore: snapshot.scores.regulatoryRisk,
      reviewStatus: persistedReviewStatus(snapshot.reviewStatus),
      safetyScore: snapshot.scores.safety,
      scoreVersion: snapshot.scoreVersion
    })),
    sourcePacketReferences: rows.sourcePacketReferences.map((row) => ({ ...row })),
    sourcePackets: rows.sourcePackets.map((packet) => ({
      ...packet,
      reviewStatus: persistedReviewStatus(packet.reviewStatus)
    }))
  };
}

function persistedReviewStatus(reviewStatus: string): PersistedReviewStatus {
  if (reviewStatus === "Human reviewed") {
    return "HUMAN_REVIEWED";
  }

  if (reviewStatus === "AI reviewed") {
    return "AI_REVIEWED";
  }

  return "UNREVIEWED_AI_DRAFT";
}

function persistedEvidenceLabel(label: string): PersistedEvidenceLabel {
  switch (label) {
    case "Core Evidence-Based":
      return "CORE_EVIDENCE_BASED";
    case "Conditional / Biomarker-Gated":
      return "CONDITIONAL_BIOMARKER_GATED";
    case "Useful for Specific Use Case":
      return "USEFUL_FOR_SPECIFIC_USE_CASE";
    case "Reasonable N-of-1 Experiment":
      return "REASONABLE_N_OF_1_EXPERIMENT";
    case "Speculative Watchlist":
      return "SPECULATIVE_WATCHLIST";
    case "Safety Concern":
      return "SAFETY_CONCERN";
    case "Avoid / Not Recommended":
      return "AVOID_NOT_RECOMMENDED";
    case "Requires Clinician Oversight":
      return "REQUIRES_CLINICIAN_OVERSIGHT";
    case "Regulatory Concern":
      return "REGULATORY_CONCERN";
    case "Insufficient Evidence":
      return "INSUFFICIENT_EVIDENCE";
    default:
      throw new Error(`Unhandled seed evidence label: ${label}`);
  }
}
