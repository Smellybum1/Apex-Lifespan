import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ChangelogPage from "@/app/changelog/page";
import FeedbackPage from "@/app/feedback/page";
import MethodologyPage from "@/app/methodology/page";
import PrivacyPage from "@/app/privacy/page";
import TermsPage from "@/app/terms/page";

describe("public legal pages", () => {
  it("renders the methodology and score legend page", () => {
    const html = renderToStaticMarkup(<MethodologyPage />);

    expect(html).toContain("Methodology &amp; Score Legend");
    expect(html).toContain(
      "How Apex Lifespan scores supplement, peptide, and healthspan-intervention claims."
    );
    expect(html).toContain("Apex scores claims, not compounds.");
    expect(html).toContain("A score needs a traceable source packet");
    expect(html).toContain("Directness");
    expect(html).toContain("Low regulatory risk");
    expect(html).toContain("Product caveat context");
    expect(html).toContain("Regulatory risk can cap or override");
    expect(html).toContain("Directness</th><td");
    expect(html).toContain("22%");
    expect(html).toContain("current weights shown here");
    expect(html).toContain("starter component values");
    expect(html).toContain("Source-blocked");
    expect(html).toContain("8.0-10");
    expect(html).toContain("Core Evidence-Based");
    expect(html).toContain("Animal lifespan evidence is not human longevity evidence.");
    expect(html).toContain("Peptides are not treated as ordinary supplements");
    expect(html).toContain("Human reviewed does not mean clinical guideline endorsed.");
    expect(html).toContain("New RCT");
    expect(html).toContain("Scores are claim-specific, not compound-wide.");
    expect(html).toContain("Scores do not prove product-level AU/TGA authorization.");
    expect(html).toContain("Creatine");
    expect(html).toContain("Vitamin D");
    expect(html).toContain("BPC-157");
    expect(html).toContain('href="#score-components"');
  });

  it("keeps trust-critical methodology guardrails visible", () => {
    const methodologyHtml = renderToStaticMarkup(<MethodologyPage />);
    const termsHtml = renderToStaticMarkup(<TermsPage />);

    expect(methodologyHtml).toContain("Apex scores claims, not compounds.");
    expect(methodologyHtml).toContain("A score needs a traceable source packet");
    expect(methodologyHtml).toContain("Scores are not personal medical advice.");
    expect(methodologyHtml).toContain("Scores do not prove product-level AU/TGA authorization.");
    expect(methodologyHtml).toContain("Human reviewed does not mean clinical guideline endorsed.");
    expect(methodologyHtml).toContain("Animal lifespan evidence is not human longevity evidence.");
    expect(methodologyHtml).toContain("Biomarker effects are not automatically clinical outcomes.");
    expect(methodologyHtml).toContain("Mechanistic plausibility is not proof of benefit.");
    expect(methodologyHtml).toContain("Peptides are not treated as ordinary supplements");
    expect(methodologyHtml).toContain(
      "Apex must not provide sourcing, compounding, reconstitution, injection, cycling, or self-administration"
    );
    expect(termsHtml).toContain(
      "Do not use the service to seek peptide sourcing, compounding, reconstitution, injection, cycling, dosing, or self-administration instructions."
    );
  });

  it("renders the public changelog with evidence and scoring updates", async () => {
    const html = renderToStaticMarkup(await ChangelogPage());

    expect(html).toContain("Apex Lifespan Changelog");
    expect(html).toContain("Public trust record");
    expect(html).toContain('href="/"');
    expect(html).toContain("what this does not prove");
    expect(html).toContain("Added BPC-157 regulatory card");
    expect(html).toContain("Added psyllium lipid evidence card");
    expect(html).toContain("Score changed:");
    expect(html).toContain("Omega-3 CV events");
    expect(html).toContain("6.2");
    expect(html).toContain("5.9");
    expect(html).toContain("not medical advice");
  });

  it("renders the public feedback and issue intake page", () => {
    const html = renderToStaticMarkup(<FeedbackPage />);

    expect(html).toContain("Feedback &amp; Issue Intake");
    expect(html).toContain("Open GitHub Issue");
    expect(html).toContain("https://github.com/Smellybum1/Apex-Lifespan/issues/new");
    expect(html).toContain("Next scheduled review: June 14, 2026 post-launch review.");
    expect(html).toContain("Project operator / evidence reviewer.");
    expect(html).toContain("source review, citation traceability");
    expect(html).toContain("Do not include private health information");
    expect(html).toContain("peptide sourcing");
  });

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
