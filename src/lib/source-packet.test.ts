import { describe, expect, it } from "vitest";

import {
  buildClaimSourcePacket,
  summarizeEvidenceDepth,
  summarizeClaimSourcePackets
} from "@/lib/source-packet";
import { claims, references, studies } from "@/lib/seed-data";
import type { Claim, Reference, Study } from "@/lib/types";

const referencesById = new Map(references.map((reference) => [reference.id, reference]));

describe("buildClaimSourcePacket", () => {
  it("links a claim to its extracted study records", () => {
    const claim = claims.find((item) => item.id === "creatine-strength");

    expect(claim).toBeDefined();

    const packet = buildClaimSourcePacket({
      claim: claim as Claim,
      referencesById,
      studies
    });

    expect(packet.referenceIds).toEqual(["issn-creatine-2017"]);
    expect(packet.references.map((reference) => reference.id)).toEqual(["issn-creatine-2017"]);
    expect(packet.studies.map((study) => study.id)).toEqual(["study-creatine-issn"]);
    expect(packet.pendingReferences).toEqual([]);
    expect(packet.missingReferenceIds).toEqual([]);
    expect(packet.completeness).toMatchObject({
      status: "complete",
      label: "Extraction complete",
      nextStep: "Keep source links reviewed as new evidence or regulatory updates appear.",
      totalReferences: 1,
      extractedReferences: 1,
      pendingReferences: 0,
      missingReferences: 0
    });
    expect(packet.evidenceDepth).toMatchObject({
      sourcePackets: 1,
      reviewPositionStandSources: 1,
      directHumanTrials: 0,
      systematicReviews: 0,
      totalExtractedStudies: 1
    });
    expect(packet.evidenceDepth.badges.map((badge) => badge.label)).toEqual(
      expect.arrayContaining([
        "1 source packet",
        "1 review/position-stand source extracted",
        "0 individual human trial rows extracted"
      ])
    );
    expect(
      packet.evidenceDepth.badges.find((badge) => badge.kind === "human-trials-none")?.detail
    ).toContain("This does not mean no human trials exist");
  });

  it("keeps current seed claim source packets fully extracted", () => {
    const incompletePackets = claims
      .filter((claim) => claim.keyReferenceIds.length > 0)
      .flatMap((claim) => {
        const packet = buildClaimSourcePacket({
          claim,
          referencesById,
          studies
        });

        return packet.completeness.status === "complete"
          ? []
          : [
              {
                claimId: claim.id,
                pendingReferenceIds: packet.pendingReferences.map((reference) => reference.id),
                missingReferenceIds: packet.missingReferenceIds
              }
            ];
      });

    expect(incompletePackets).toEqual([]);
  });

  it("summarizes current seed claim source packet coverage", () => {
    expect(
      summarizeClaimSourcePackets({
        claims,
        referencesById,
        studies
      })
    ).toEqual({
      completeClaims: 9,
      extractionPendingClaims: 0,
      extractedReferences: 10,
      missingReferences: 0,
      missingSourceClaims: 0,
      pendingReferences: 0,
      totalClaims: 9,
      totalReferences: 10,
      unlinkedClaims: 0
    });
  });

  it("links omega-3, psyllium, and TGA seed references to structured extraction rows", () => {
    const claim = claims.find((item) => item.id === "omega-3-triglycerides");
    const psylliumClaim = claims.find((item) => item.id === "psyllium-ldl-lipids");
    const bpcClaim = claims.find((item) => item.id === "bpc-157-injury-healing");

    expect(claim).toBeDefined();
    expect(psylliumClaim).toBeDefined();
    expect(bpcClaim).toBeDefined();

    const omegaPacket = buildClaimSourcePacket({
      claim: claim as Claim,
      referencesById,
      studies
    });
    const psylliumPacket = buildClaimSourcePacket({
      claim: psylliumClaim as Claim,
      referencesById,
      studies
    });
    const bpcPacket = buildClaimSourcePacket({
      claim: bpcClaim as Claim,
      referencesById,
      studies
    });

    expect(omegaPacket.studies.map((study) => study.id)).toEqual(["study-omega-3-ods"]);
    expect(omegaPacket.completeness.status).toBe("complete");
    expect(psylliumPacket.studies.map((study) => study.id)).toEqual([
      "study-brown-dietary-fiber-1999"
    ]);
    expect(psylliumPacket.completeness.status).toBe("complete");
    expect(bpcPacket.studies.map((study) => study.id).sort()).toEqual([
      "study-fda-bpc-157",
      "study-tga-unapproved-peptides"
    ]);
    expect(bpcPacket.completeness).toMatchObject({
      status: "complete",
      totalReferences: 2,
      extractedReferences: 2,
      pendingReferences: 0,
      missingReferences: 0
    });
    expect(bpcPacket.evidenceDepth).toMatchObject({
      directHumanTrials: 0,
      regulatorySafetyWarnings: 2,
      totalExtractedStudies: 2
    });
    expect(bpcPacket.evidenceDepth.badges.map((badge) => badge.label)).toEqual(
      expect.arrayContaining([
        "1 source packet",
        "2 regulatory warning sources",
        "0 individual human trial rows extracted",
        "2 regulatory-only sources"
      ])
    );
  });

  it("keeps linked references visible when study extraction is pending", () => {
    const pendingReference: Reference = {
      id: "pending-ref",
      title: "Pending source",
      source: "PubMed",
      url: "https://pubmed.ncbi.nlm.nih.gov/"
    };

    const packet = buildClaimSourcePacket({
      claim: { keyReferenceIds: ["pending-ref"] },
      referencesById: new Map([[pendingReference.id, pendingReference]]),
      studies: []
    });

    expect(packet.references).toEqual([pendingReference]);
    expect(packet.studies).toEqual([]);
    expect(packet.pendingReferences).toEqual([pendingReference]);
    expect(packet.missingReferenceIds).toEqual([]);
    expect(packet.completeness).toMatchObject({
      status: "extraction_pending",
      label: "Extraction pending",
      nextStep:
        "Add structured extraction for the pending references before treating this packet as complete.",
      totalReferences: 1,
      extractedReferences: 0,
      pendingReferences: 1,
      missingReferences: 0
    });
    expect(packet.evidenceDepth.badges.map((badge) => badge.label)).toEqual([
      "1 source packet",
      "0 individual human trial rows extracted"
    ]);
  });

  it("dedupes claim reference ids and reports missing references", () => {
    const knownReference: Reference = {
      id: "known-ref",
      title: "Known source",
      source: "PubMed",
      url: "https://pubmed.ncbi.nlm.nih.gov/"
    };
    const packet = buildClaimSourcePacket({
      claim: { keyReferenceIds: ["known-ref", "missing-ref", "known-ref"] },
      referencesById: new Map([[knownReference.id, knownReference]]),
      studies: []
    });

    expect(packet.referenceIds).toEqual(["known-ref", "missing-ref"]);
    expect(packet.references).toEqual([knownReference]);
    expect(packet.pendingReferences).toEqual([knownReference]);
    expect(packet.missingReferenceIds).toEqual(["missing-ref"]);
    expect(packet.completeness).toMatchObject({
      status: "missing_sources",
      label: "Source records missing",
      nextStep: "Restore the missing curated source records before relying on this packet.",
      totalReferences: 2,
      extractedReferences: 0,
      pendingReferences: 1,
      missingReferences: 1
    });
  });

  it("reports claims without curated source links", () => {
    const packet = buildClaimSourcePacket({
      claim: { keyReferenceIds: [] },
      referencesById,
      studies
    });

    expect(packet.referenceIds).toEqual([]);
    expect(packet.references).toEqual([]);
    expect(packet.studies).toEqual([]);
    expect(packet.pendingReferences).toEqual([]);
    expect(packet.missingReferenceIds).toEqual([]);
    expect(packet.completeness).toMatchObject({
      status: "not_linked",
      label: "No curated sources",
      nextStep:
        "Add curated reference links before treating this claim as source-backed.",
      totalReferences: 0,
      extractedReferences: 0,
      pendingReferences: 0,
      missingReferences: 0
    });
    expect(packet.evidenceDepth.badges.map((badge) => badge.label)).toEqual([
      "0 source packets",
      "0 individual human trial rows extracted"
    ]);
  });

  it("summarizes higher-depth human evidence without the no-human-trials badge", () => {
    const packet = buildClaimSourcePacket({
      claim: { keyReferenceIds: ["rct-ref-1", "rct-ref-2", "meta-ref"] },
      referencesById: new Map(
        ["rct-ref-1", "rct-ref-2", "meta-ref"].map((id) => [
          id,
          {
            id,
            title: `Reference ${id}`,
            source: "PubMed",
            url: "https://pubmed.ncbi.nlm.nih.gov/"
          }
        ])
      ),
      studies: [
        studyFixture({
          id: "study-rct-1",
          referenceId: "rct-ref-1",
          studyType: "Randomized controlled trial"
        }),
        studyFixture({
          id: "study-rct-2",
          referenceId: "rct-ref-2",
          studyType: "Randomized controlled trial"
        }),
        studyFixture({
          id: "study-meta",
          referenceId: "meta-ref",
          studyType: "Meta-analysis"
        })
      ]
    });

    const labels = packet.evidenceDepth.badges.map((badge) => badge.label);

    expect(packet.evidenceDepth).toMatchObject({
      directHumanTrials: 2,
      metaAnalyses: 1,
      randomizedControlledTrials: 2
    });
    expect(labels).toEqual(
      expect.arrayContaining([
        "1 source packet",
        "2 RCT rows extracted",
        "1 meta-analysis extracted"
      ])
    );
    expect(labels).not.toContain("0 individual human trial rows extracted");
  });

  it("distinguishes verified systematic reviews from review and position-stand sources", () => {
    const systematicSummary = summarizeEvidenceDepth({
      completeness: {
        status: "complete",
        label: "Extraction complete",
        detail: "Fixture detail.",
        nextStep: "Fixture next step.",
        totalReferences: 1,
        extractedReferences: 1,
        pendingReferences: 0,
        missingReferences: 0
      },
      studies: [
        studyFixture({
          id: "study-systematic-review",
          referenceId: "systematic-review-ref",
          studyType: "Systematic review"
        })
      ]
    });
    const positionStandSummary = summarizeEvidenceDepth({
      completeness: {
        status: "complete",
        label: "Extraction complete",
        detail: "Fixture detail.",
        nextStep: "Fixture next step.",
        totalReferences: 1,
        extractedReferences: 1,
        pendingReferences: 0,
        missingReferences: 0
      },
      studies: [
        studyFixture({
          id: "study-position-stand",
          referenceId: "position-stand-ref",
          sourceTypeTaxonomy: "position stand",
          studyType: "Systematic review"
        })
      ]
    });

    expect(systematicSummary).toMatchObject({
      reviewPositionStandSources: 0,
      systematicReviews: 1
    });
    expect(systematicSummary.badges.map((badge) => badge.label)).toEqual(
      expect.arrayContaining(["1 systematic review extracted"])
    );
    expect(systematicSummary.badges.map((badge) => badge.label)).not.toContain(
      "1 review/position-stand source extracted"
    );
    expect(positionStandSummary).toMatchObject({
      reviewPositionStandSources: 1,
      systematicReviews: 0
    });
    expect(positionStandSummary.badges.map((badge) => badge.label)).toEqual(
      expect.arrayContaining(["1 review/position-stand source extracted"])
    );
  });

  it("labels animal and mechanistic-only packets as indirect evidence", () => {
    const summary = summarizeEvidenceDepth({
      completeness: {
        status: "complete",
        label: "Extraction complete",
        detail: "Fixture detail.",
        nextStep: "Fixture next step.",
        totalReferences: 2,
        extractedReferences: 2,
        pendingReferences: 0,
        missingReferences: 0
      },
      studies: [
        studyFixture({
          id: "study-animal",
          referenceId: "animal-ref",
          studyType: "Animal study"
        }),
        studyFixture({
          id: "study-mechanistic",
          referenceId: "mechanistic-ref",
          studyType: "In vitro/mechanistic"
        })
      ]
    });

    expect(summary).toMatchObject({
      animalMechanisticStudies: 2,
      directHumanTrials: 0,
      totalExtractedStudies: 2
    });
    expect(summary.badges.map((badge) => badge.label)).toEqual(
      expect.arrayContaining([
        "1 source packet",
        "0 individual human trial rows extracted",
        "Animal/mechanistic only"
      ])
    );
  });

  it("summarizes mixed source packet completeness states", () => {
    const completeReference: Reference = {
      id: "complete-ref",
      title: "Complete source",
      source: "PubMed",
      url: "https://pubmed.ncbi.nlm.nih.gov/"
    };
    const pendingReference: Reference = {
      id: "pending-ref",
      title: "Pending source",
      source: "PubMed",
      url: "https://pubmed.ncbi.nlm.nih.gov/"
    };
    const extractedStudy: Study = {
      id: "study-complete",
      title: "Complete source extraction",
      year: 2026,
      source: "PubMed",
      studyType: "Systematic review",
      sampleSize: "1 source",
      population: "Adults",
      intervention: "Example",
      outcomes: ["Traceability"],
      adverseEvents: "Not assessed in this fixture.",
      fundingConflicts: "Not assessed in this fixture.",
      riskOfBias: "Fixture only.",
      referenceId: "complete-ref"
    };

    expect(
      summarizeClaimSourcePackets({
        claims: [
          { keyReferenceIds: ["complete-ref"] },
          { keyReferenceIds: ["pending-ref"] },
          { keyReferenceIds: ["missing-ref"] },
          { keyReferenceIds: [] }
        ],
        referencesById: new Map([
          [completeReference.id, completeReference],
          [pendingReference.id, pendingReference]
        ]),
        studies: [extractedStudy]
      })
    ).toEqual({
      completeClaims: 1,
      extractionPendingClaims: 1,
      extractedReferences: 1,
      missingReferences: 1,
      missingSourceClaims: 1,
      pendingReferences: 1,
      totalClaims: 4,
      totalReferences: 3,
      unlinkedClaims: 1
    });
  });
});

function studyFixture({
  id,
  referenceId,
  sourceTypeTaxonomy,
  studyType
}: {
  id: string;
  referenceId: string;
  sourceTypeTaxonomy?: Study["sourceTypeTaxonomy"];
  studyType: Study["studyType"];
}): Study {
  return {
    id,
    adverseEvents: "Not assessed in this fixture.",
    fundingConflicts: "Not assessed in this fixture.",
    intervention: "Example intervention",
    outcomes: ["Example outcome"],
    population: "Adults",
    referenceId,
    riskOfBias: "Fixture only.",
    sampleSize: "Fixture sample",
    source: "PubMed",
    sourceTypeTaxonomy,
    studyType,
    title: `Fixture ${studyType}`,
    year: 2026
  };
}
