import { describe, expect, it } from "vitest";

import { formatProductRegionLabel } from "@/lib/product-signals";

describe("product signal helpers", () => {
  it("formats common region codes for product cards", () => {
    expect(formatProductRegionLabel("AU")).toBe("Australia");
    expect(formatProductRegionLabel("US")).toBe("United States");
  });

  it("keeps Australia verification-pending language explicit", () => {
    expect(formatProductRegionLabel("AU verification pending")).toBe("AU verification pending");
    expect(formatProductRegionLabel("AU-ready")).toBe("AU verification pending");
  });

  it("handles missing product market context", () => {
    expect(formatProductRegionLabel("   ")).toBe("Market not captured");
  });
});
