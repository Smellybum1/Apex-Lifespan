import { describe, expect, it } from "vitest";

import {
  australiaRegulatoryKindDescription,
  getPrimaryAustraliaStatus,
  isTgaEfficacyAssessed
} from "@/lib/regulatory";
import { australiaRegulatoryStatuses } from "@/lib/seed-data";

describe("Australia regulatory helpers", () => {
  it("treats AUST L(A) and AUST R as efficacy-assessed categories", () => {
    expect(isTgaEfficacyAssessed("AUST L")).toBe(false);
    expect(isTgaEfficacyAssessed("AUST L(A)")).toBe(true);
    expect(isTgaEfficacyAssessed("AUST R")).toBe(true);
  });

  it("keeps unknown ARTG status distinct from unapproved concern", () => {
    expect(australiaRegulatoryKindDescription("Unknown")).toContain("not been verified");
    expect(australiaRegulatoryKindDescription("Unapproved")).toContain(
      "clinician-review focused"
    );
  });

  it("surfaces peptide watchlist status for BPC-157", () => {
    const status = getPrimaryAustraliaStatus(australiaRegulatoryStatuses, "bpc-157");

    expect(status?.kind).toBe("Unapproved");
    expect(status?.supplySummary).toContain("no self-use instructions");
  });
});
