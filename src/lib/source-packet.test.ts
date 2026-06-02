import { describe, expect, it } from "vitest";

import { buildClaimSourcePacket } from "@/lib/source-packet";
import { claims, references, studies } from "@/lib/seed-data";
import type { Claim, Reference } from "@/lib/types";

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

  it("links omega-3 and TGA seed references to structured extraction rows", () => {
    const claim = claims.find((item) => item.id === "omega-3-triglycerides");
    const bpcClaim = claims.find((item) => item.id === "bpc-157-injury-healing");

    expect(claim).toBeDefined();
    expect(bpcClaim).toBeDefined();

    const omegaPacket = buildClaimSourcePacket({
      claim: claim as Claim,
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
  });
});
