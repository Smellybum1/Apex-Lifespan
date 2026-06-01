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
      totalReferences: 1,
      extractedReferences: 1,
      pendingReferences: 0,
      missingReferences: 0
    });
  });

  it("keeps linked references visible when study extraction is pending", () => {
    const claim = claims.find((item) => item.id === "omega-3-triglycerides");

    expect(claim).toBeDefined();

    const packet = buildClaimSourcePacket({
      claim: claim as Claim,
      referencesById,
      studies
    });

    expect(packet.references.map((reference) => reference.id)).toEqual(["ods-omega-3"]);
    expect(packet.studies).toEqual([]);
    expect(packet.pendingReferences.map((reference) => reference.id)).toEqual(["ods-omega-3"]);
    expect(packet.missingReferenceIds).toEqual([]);
    expect(packet.completeness).toMatchObject({
      status: "extraction_pending",
      label: "Extraction pending",
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
      totalReferences: 0,
      extractedReferences: 0,
      pendingReferences: 0,
      missingReferences: 0
    });
  });
});
