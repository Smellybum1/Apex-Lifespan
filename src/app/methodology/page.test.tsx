import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import MethodologyPage from "@/app/methodology/page";

describe("methodology page", () => {
  it("renders the current public scoring model legend", () => {
    const html = renderToStaticMarkup(<MethodologyPage />);

    expect(html).toContain("Methodology &amp; Score Legend");
    expect(html).toContain("Apex scores claims, not compounds.");
    expect(html).toContain("Directness");
    expect(html).toContain("Rigor");
    expect(html).toContain("Low regulatory risk");
    expect(html).toContain("0-3.9");
    expect(html).toContain("Weak");
    expect(html).not.toContain("Very weak / concern");
    expect(html).toContain("Avoid / Not Recommended");
    expect(html).toContain("Source work");
    expect(html).toContain("Snapshot gap");
    expect(html).toContain("Unreviewed AI draft");
    expect(html).toContain("Human reviewed does not mean clinical guideline endorsed.");
  });
});
