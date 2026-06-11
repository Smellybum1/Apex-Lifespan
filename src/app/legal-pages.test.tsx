import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PrivacyPage from "@/app/privacy/page";
import TermsPage from "@/app/terms/page";

describe("public legal pages", () => {
  it("renders privacy boundaries for the public dashboard", () => {
    const html = renderToStaticMarkup(<PrivacyPage />);

    expect(html).toContain("Privacy");
    expect(html).toContain("public evidence dashboard");
    expect(html).toContain("Public routes are read-only");
    expect(html).toContain("Live Source Searches");
    expect(html).toContain("Browser Storage");
  });

  it("renders terms boundaries for evidence and regulatory use", () => {
    const html = renderToStaticMarkup(<TermsPage />);

    expect(html).toContain("Terms");
    expect(html).toContain("No Medical Advice");
    expect(html).toContain("Evidence Is Provisional");
    expect(html).toContain("Australia/TGA Context");
    expect(html).toContain("Public Read-Only Surface");
  });
});
