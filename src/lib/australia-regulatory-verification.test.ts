import { describe, expect, it } from "vitest";

import {
  buildProductAustraliaRegulatoryVerifications,
  summarizeAustraliaRegulatoryVerification
} from "@/lib/australia-regulatory-verification";
import { australiaRegulatoryStatuses, productSignals } from "@/lib/seed-data";

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
      interventionLevelStatuses: 5,
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
});
