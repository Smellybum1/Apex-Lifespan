import { describe, expect, it } from "vitest";

import {
  buildParsedAustraliaRegulatoryIdentifierVerifications,
  buildProductAustraliaRegulatoryVerifications,
  summarizeAustraliaRegulatoryVerification
} from "@/lib/australia-regulatory-verification";
import {
  australiaRegulatoryStatuses,
  interventions,
  productSignals
} from "@/lib/seed-data";

describe("Australia regulatory verification summary", () => {
  it("keeps product-level verification separate from intervention-level status", () => {
    const summary = summarizeAustraliaRegulatoryVerification(
      {
        australiaRegulatoryStatuses,
        productSignals
      },
      {
        now: new Date("2026-06-11T00:00:00.000Z")
      }
    );

    expect(summary).toMatchObject({
      confidenceCounts: {
        High: 0,
        Low: 0,
        Moderate: 0,
        "Very low": 2
      },
      interventionLevelStatuses: interventions.length,
      productLevelStatuses: 2,
      productsMissingStatus: [],
      staleStatusIds: [],
      unknownProductStatusIds: [
        "au-reg-seed-blend-product",
        "au-reg-seed-creatine-product"
      ]
    });
    expect(summary.productVerifications).toEqual([
      expect.objectContaining({
        confidence: "Very low",
        productId: "seed-blend-product",
        state: "Unknown",
        stateLabel: "Product-level status unknown"
      }),
      expect.objectContaining({
        confidence: "Very low",
        productId: "seed-creatine-product",
        state: "Unknown",
        stateLabel: "Product-level status unknown"
      })
    ]);
  });

  it("reports stale and missing product-level statuses without using intervention status as a fallback", () => {
    expect(
      summarizeAustraliaRegulatoryVerification(
        {
          australiaRegulatoryStatuses: australiaRegulatoryStatuses.filter(
            (status) => status.id !== "au-reg-seed-blend-product"
          ),
          productSignals
        },
        {
          now: new Date("2027-01-01T00:00:00.000Z")
        }
      )
    ).toMatchObject({
      productsMissingStatus: ["seed-blend-product"],
      staleStatusIds: expect.arrayContaining(["au-reg-seed-creatine-product"]),
      productVerifications: expect.arrayContaining([
        expect.objectContaining({
          confidence: "Very low",
          productId: "seed-blend-product",
          state: "Missing"
        }),
        expect.objectContaining({
          confidence: "Very low",
          productId: "seed-creatine-product",
          state: "Stale"
        })
      ])
    });
  });

  it("assigns higher confidence only to fresh product-level records with product identifiers", () => {
    const verifications = buildProductAustraliaRegulatoryVerifications(
      {
        australiaRegulatoryStatuses: [
          {
            ...australiaRegulatoryStatuses.find(
              (status) => status.id === "au-reg-seed-creatine-product"
            )!,
            austNumber: "AUST R 123456",
            kind: "AUST R",
            status: "Registered medicine record captured"
          }
        ],
        productSignals
      },
      {
        now: new Date("2026-06-11T00:00:00.000Z")
      }
    );

    expect(verifications).toEqual([
      expect.objectContaining({
        confidence: "Very low",
        productId: "seed-blend-product",
        state: "Missing"
      }),
      expect.objectContaining({
        confidence: "High",
        productId: "seed-creatine-product",
        state: "Verified",
        status: expect.objectContaining({ kind: "AUST R" })
      })
    ]);
  });

  it("labels reviewed non-AUST product records as captured rather than verified", () => {
    const verifications = buildProductAustraliaRegulatoryVerifications(
      {
        australiaRegulatoryStatuses: [
          {
            ...australiaRegulatoryStatuses.find(
              (status) => status.id === "au-reg-seed-blend-product"
            )!,
            kind: "Not in ARTG",
            status: "Reviewed product-level ARTG search did not find a current entry"
          }
        ],
        productSignals
      },
      {
        now: new Date("2026-06-11T00:00:00.000Z")
      }
    );

    expect(verifications).toEqual([
      expect.objectContaining({
        confidence: "Low",
        nextAction:
          "Keep the captured product-level source linked, but do not treat this status as verified Australian market authorisation or product efficacy evidence.",
        productId: "seed-blend-product",
        state: "Captured",
        stateLabel: "Product-level status captured"
      }),
      expect.objectContaining({
        confidence: "Very low",
        productId: "seed-creatine-product",
        state: "Missing"
      })
    ]);
  });

  it("matches parsed AUST identifiers to local product-level status records", () => {
    const [verification] = buildParsedAustraliaRegulatoryIdentifierVerifications(
      [
        {
          identifier: "123456",
          kind: "AUST L",
          label: "AUST L 123456"
        }
      ],
      {
        australiaRegulatoryStatuses: [
          {
            ...australiaRegulatoryStatuses.find(
              (status) => status.id === "au-reg-seed-creatine-product"
            )!,
            austNumber: "AUST L 123456",
            kind: "AUST L",
            status: "Listed medicine record captured"
          }
        ],
        productSignals
      },
      {
        now: new Date("2026-06-11T00:00:00.000Z")
      }
    );

    expect(verification).toMatchObject({
      confidence: "Moderate",
      identifier: "123456",
      kind: "AUST L",
      matchState: "local-product-match",
      matchStateLabel: "Local product record matched",
      productBrand: "Demo profile",
      productId: "seed-creatine-product",
      productName: "Creatine monohydrate powder",
      status: expect.objectContaining({
        austNumber: "AUST L 123456",
        id: "au-reg-seed-creatine-product"
      })
    });
  });

  it("carries stale product-level verification state on parsed AUST identifier matches", () => {
    const [verification] = buildParsedAustraliaRegulatoryIdentifierVerifications(
      [
        {
          identifier: "123456",
          kind: "AUST R",
          label: "AUST R 123456"
        }
      ],
      {
        australiaRegulatoryStatuses: [
          {
            ...australiaRegulatoryStatuses.find(
              (status) => status.id === "au-reg-seed-creatine-product"
            )!,
            austNumber: "AUST R 123456",
            checkedAt: "2026-01-01",
            kind: "AUST R",
            status: "Registered medicine record captured"
          }
        ],
        productSignals
      },
      {
        now: new Date("2027-01-01T00:00:00.000Z")
      }
    );

    expect(verification).toMatchObject({
      confidence: "Very low",
      matchState: "local-product-match",
      productId: "seed-creatine-product",
      productVerification: expect.objectContaining({
        confidence: "Very low",
        isStale: true,
        state: "Stale",
        stateLabel: "Product-level status stale"
      })
    });
    expect(verification.nextAction).toContain("Re-check the product-level ARTG/AUST source");
  });

  it("does not treat intervention-level AUST matches as product verification", () => {
    const [verification] = buildParsedAustraliaRegulatoryIdentifierVerifications(
      [
        {
          identifier: "123456",
          kind: "AUST L",
          label: "AUST L 123456"
        }
      ],
      {
        australiaRegulatoryStatuses: [
          {
            ...australiaRegulatoryStatuses.find(
              (status) => status.id === "au-reg-creatine-intervention"
            )!,
            austNumber: "AUST L 123456",
            kind: "AUST L",
            status: "Ingredient-level status example"
          }
        ],
        productSignals
      },
      {
        now: new Date("2026-06-11T00:00:00.000Z")
      }
    );

    expect(verification).toMatchObject({
      confidence: "Very low",
      interventionStatusIds: ["au-reg-creatine-intervention"],
      matchState: "local-intervention-only-match",
      matchStateLabel: "Only intervention-level status matched"
    });
    expect(verification.productId).toBeUndefined();
    expect(verification.nextAction).toContain("Do not treat this as product verification");
  });

  it("keeps unmatched parsed AUST identifiers as label-only evidence", () => {
    const [verification] = buildParsedAustraliaRegulatoryIdentifierVerifications(
      [
        {
          identifier: "999999",
          kind: "AUST R",
          label: "AUST R 999999"
        }
      ],
      {
        australiaRegulatoryStatuses,
        productSignals
      },
      {
        now: new Date("2026-06-11T00:00:00.000Z")
      }
    );

    expect(verification).toMatchObject({
      confidence: "Very low",
      interventionStatusIds: [],
      matchState: "unmatched-parsed-identifier",
      matchStateLabel: "Parsed only; no local product record"
    });
    expect(verification.status).toBeUndefined();
    expect(verification.nextAction).toContain("Parsed from label text only");
  });
});
