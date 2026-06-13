import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildFullTextFixtureExtractionDraft,
  buildFullTextFixtureProgressReport,
  buildFullTextLocalFixtureTemplate,
  buildFullTextFixtureReviewReport,
  parseFullTextLocalFixture,
  summarizeFullTextFixtureExtractionDraft,
  summarizeFullTextFixtureProgressReport,
  summarizeFullTextFixtureReviewReport
} from "@/lib/full-text-fixture";

describe("full text local fixture", () => {
  it("builds a parseable local fixture template that is blocked until filled", () => {
    const template = buildFullTextLocalFixtureTemplate({
      capturedAt: "2026-06-12T00:00:00.000Z",
      sourceId: "pmc-open-access",
      sourceUrl: "https://example.test/pmc-open-access",
      title: "PMC local fixture starter"
    });
    const report = buildFullTextFixtureReviewReport({ fixture: template });

    expect(template).toMatchObject({
      capturedAt: "2026-06-12T00:00:00.000Z",
      sourceId: "pmc-open-access",
      sourceUrl: "https://example.test/pmc-open-access",
      title: "PMC local fixture starter"
    });
    expect(template.derivedExtractionTargets.map((target) => target.field)).toEqual([
      "population",
      "intervention",
      "comparator",
      "duration",
      "mainResults",
      "safetyNotes"
    ]);
    expect(template.derivedExtractionTargets.every((target) => target.value === "")).toBe(true);
    expect(report.summary).toMatchObject({
      blockers: 1,
      missingTargets: 6,
      readyForDerivedReview: false,
      targets: 6
    });
    expect(report.blockers).toContain(
      "At least one derived extraction target needs a reviewed value."
    );
  });

  it("parses a synthetic local fixture into a derived-only report", () => {
    const fixture = parseFullTextLocalFixture(
      JSON.parse(
        readFileSync(
          "docs/codex/onboarding/examples/fulltext-local-fixture.example.json",
          "utf8"
        )
      ) as unknown
    );
    const report = buildFullTextFixtureReviewReport({
      fixture,
      generatedAt: new Date("2026-06-12T00:00:00.000Z")
    });
    const summary = summarizeFullTextFixtureReviewReport(report);

    expect(report).toMatchObject({
      derivedOnly: true,
      generatedAt: "2026-06-12T00:00:00.000Z",
      localOnly: true,
      noAutoApproval: true,
      noCandidateDecision: true,
      noConnectorApproval: true,
      noExtractionWrite: true,
      noLiveFetch: true,
      noNetworkFetch: true,
      noPublicRawTextExport: true,
      noPromotion: true,
      rawTextStored: false,
      readOnly: true,
      summary: {
        blockers: 0,
        readyForDerivedReview: true,
        targets: 4
      }
    });
    expect(report.source).toMatchObject({
      sourceId: "synthetic-reviewed-open-access-source",
      sourceUrl: "https://example.test/full-text-fixture",
      title: "Synthetic reviewed fixture for parser-shape rehearsal"
    });
    expect(report.targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          confidence: "Strong",
          field: "population",
          hasValue: true
        })
      ])
    );
    expect(JSON.stringify(summary)).not.toContain(
      "This synthetic excerpt is intentionally short"
    );
  });

  it("drafts a read-only extraction command from reviewed fixture fields", () => {
    const fixture = parseFullTextLocalFixture({
      capturedAt: "2026-06-12T00:00:00.000Z",
      derivedExtractionTargets: [
        {
          confidence: "Strong",
          field: "sampleSize",
          quoteLocator: "fixture:sample",
          value: "n=80 analyzed participants"
        },
        {
          confidence: "Strong",
          field: "population",
          quoteLocator: "fixture:population",
          value: "Adults with reviewed eligibility criteria"
        },
        {
          confidence: "Strong",
          field: "intervention",
          quoteLocator: "fixture:intervention",
          value: "Reviewed supplement exposure"
        },
        {
          confidence: "Strong",
          field: "outcome",
          quoteLocator: "fixture:outcome",
          value: "Strength outcome"
        },
        {
          confidence: "Strong",
          field: "safetyNotes",
          quoteLocator: "fixture:safety",
          value: "No serious adverse events in reviewed fixture"
        },
        {
          confidence: "Inferred",
          field: "fundingConflicts",
          quoteLocator: "fixture:funding",
          value: "Funding/conflicts require source-packet verification"
        },
        {
          confidence: "Weak",
          field: "riskOfBias",
          quoteLocator: "fixture:bias",
          value: "Risk of bias requires human verification"
        },
        {
          confidence: "Inferred",
          field: "duration",
          quoteLocator: "fixture:duration",
          value: "12 weeks"
        },
        {
          confidence: "Strong",
          field: "mainResults",
          quoteLocator: "fixture:results",
          value: "Reviewed main-result summary"
        },
        {
          confidence: "Strong",
          field: "comparator",
          quoteLocator: "fixture:comparator",
          value: "Placebo comparator"
        }
      ],
      reviewerNote: "Synthetic reviewed fixture.",
      sourceId: "fixture-source",
      sourceUrl: "https://example.test/fixture-source",
      textExcerpt: "Short local excerpt that should not appear in summaries.",
      title: "Reviewed fixture source"
    });
    const draft = buildFullTextFixtureExtractionDraft({
      candidateKey: "PubMed:12345",
      fixture,
      generatedAt: new Date("2026-06-12T00:00:00.000Z"),
      studySourceType: "randomized-controlled-trial"
    });
    const summary = summarizeFullTextFixtureExtractionDraft(draft);

    expect(draft).toMatchObject({
      derivedOnly: true,
      localOnly: true,
      noCandidateDecision: true,
      noDbValidation: true,
      noExtractionWrite: true,
      noPromotion: true,
      readOnly: true,
      summary: {
        commandDraftReady: true,
        missingRequiredFields: 0,
        reviewOnlyFields: 1
      }
    });
    expect(draft.commandTemplate).toContain("--extract-candidate-study \"PubMed:12345\"");
    expect(draft.commandTemplate).toContain("--study-source-type \"randomized-controlled-trial\"");
    expect(draft.commandTemplate).toContain("--study-sample-size \"n=80 analyzed participants\"");
    expect(draft.commandTemplate).toContain("--study-duration \"12 weeks\"");
    expect(draft.commandTemplate).toContain("--study-main-results \"Reviewed main-result summary\"");
    expect(draft.commandTemplate).not.toContain("Placebo comparator");
    expect(draft.warnings).toContain(
      "Required extraction field riskOfBias has Weak fixture confidence; verify before writing."
    );
    expect(JSON.stringify(summary)).not.toContain(
      "Short local excerpt that should not appear in summaries."
    );
  });

  it("keeps fixture extraction drafts blocked when required write fields are missing", () => {
    const fixture = parseFullTextLocalFixture(
      JSON.parse(
        readFileSync(
          "docs/codex/onboarding/examples/fulltext-local-fixture.example.json",
          "utf8"
        )
      ) as unknown
    );
    const draft = buildFullTextFixtureExtractionDraft({ fixture });
    const summary = summarizeFullTextFixtureExtractionDraft(draft);

    expect(draft.summary).toMatchObject({
      commandDraftReady: false,
      missingRequiredFields: 5
    });
    expect(draft.blockers).toEqual(
      expect.arrayContaining([
        "candidateKey is required before the extraction command draft can be reviewed for a real accepted candidate.",
        "Required extraction field is missing from reviewed fixture: sampleSize (--study-sample-size).",
        "Required extraction field is missing from reviewed fixture: outcomes (--study-outcome).",
        "Required extraction field is missing from reviewed fixture: adverseEvents (--study-adverse-events).",
        "Required extraction field is missing from reviewed fixture: fundingConflicts (--study-funding-conflicts).",
        "Required extraction field is missing from reviewed fixture: riskOfBias (--study-risk-of-bias)."
      ])
    );
    expect(summary.missingRequiredFields).toEqual([
      { field: "sampleSize", writeFlag: "--study-sample-size" },
      { field: "outcomes", writeFlag: "--study-outcome" },
      { field: "adverseEvents", writeFlag: "--study-adverse-events" },
      { field: "fundingConflicts", writeFlag: "--study-funding-conflicts" },
      { field: "riskOfBias", writeFlag: "--study-risk-of-bias" }
    ]);
  });

  it("blocks oversized local excerpts before parser-shape review", () => {
    const fixture = parseFullTextLocalFixture({
      capturedAt: "2026-06-12T00:00:00.000Z",
      derivedExtractionTargets: [
        {
          confidence: "Strong",
          field: "outcome",
          quoteLocator: "local-fixture:1",
          value: "Synthetic outcome"
        }
      ],
      reviewerNote: "Synthetic test fixture.",
      sourceId: "oversized-fixture",
      sourceUrl: "https://example.test/oversized",
      textExcerpt: "x".repeat(1201),
      title: "Oversized synthetic fixture"
    });
    const report = buildFullTextFixtureReviewReport({ fixture });

    expect(report.summary).toMatchObject({
      blockers: 1,
      readyForDerivedReview: false
    });
    expect(report.blockers[0]).toContain("local fixtures must stay at or below");
  });

  it("summarizes local fixture progress without echoing raw excerpts", () => {
    const blank = buildFullTextLocalFixtureTemplate({
      capturedAt: "2026-06-12T00:00:00.000Z",
      sourceId: "blank-source",
      title: "Blank fixture"
    });
    const filled = parseFullTextLocalFixture(
      JSON.parse(
        readFileSync(
          "docs/codex/onboarding/examples/fulltext-local-fixture.example.json",
          "utf8"
        )
      ) as unknown
    );
    const extractionReady = parseFullTextLocalFixture({
      capturedAt: "2026-06-12T00:00:00.000Z",
      derivedExtractionTargets: [
        {
          confidence: "Strong",
          field: "sampleSize",
          quoteLocator: "fixture:sample",
          value: "n=80"
        },
        {
          confidence: "Strong",
          field: "population",
          quoteLocator: "fixture:population",
          value: "Adults"
        },
        {
          confidence: "Strong",
          field: "intervention",
          quoteLocator: "fixture:intervention",
          value: "Reviewed supplement"
        },
        {
          confidence: "Strong",
          field: "outcome",
          quoteLocator: "fixture:outcome",
          value: "Strength"
        },
        {
          confidence: "Strong",
          field: "adverseEvents",
          quoteLocator: "fixture:safety",
          value: "No serious adverse events in reviewed fixture"
        },
        {
          confidence: "Strong",
          field: "fundingConflicts",
          quoteLocator: "fixture:funding",
          value: "No conflicts reported in reviewed fixture"
        },
        {
          confidence: "Strong",
          field: "riskOfBias",
          quoteLocator: "fixture:bias",
          value: "Low risk in reviewed fixture"
        }
      ],
      reviewerNote: "Progress rollup fixture.",
      sourceId: "ready-source",
      sourceUrl: "https://example.test/ready-source",
      textExcerpt: "Short reviewed excerpt that should not appear in summaries.",
      title: "Extraction-ready fixture"
    });
    const report = buildFullTextFixtureProgressReport({
      fixtures: [
        {
          content: JSON.stringify(blank),
          path: "docs/codex/onboarding/fulltext-fixtures/blank.local.json"
        },
        {
          content: JSON.stringify(filled),
          path: "docs/codex/onboarding/fulltext-fixtures/filled.local.json"
        },
        {
          content: JSON.stringify(extractionReady),
          path: "docs/codex/onboarding/fulltext-fixtures/ready.local.json"
        },
        {
          content: "{",
          path: "docs/codex/onboarding/fulltext-fixtures/broken.local.json"
        }
      ],
      generatedAt: new Date("2026-06-12T00:00:00.000Z")
    });
    const summary = summarizeFullTextFixtureProgressReport(report);

    expect(summary).toMatchObject({
      derivedOnly: true,
      generatedAt: "2026-06-12T00:00:00.000Z",
      localOnly: true,
      noCandidateDecision: true,
      noExtractionWrite: true,
      noLiveFetch: true,
      noPromotion: true,
      readOnly: true,
      summary: {
        blank: 1,
        extractionDraftReady: 1,
        filled: 1,
        files: 4,
        parseable: 3,
        unparseable: 1
      }
    });
    expect(summary.rows.map((row) => row.status)).toEqual([
      "blank",
      "unparseable",
      "filled",
      "extraction-draft-ready"
    ]);
    expect(JSON.stringify(summary)).not.toContain(
      "Short reviewed excerpt that should not appear in summaries."
    );
  });

  it("flags missing target values and URL credential risks", () => {
    const fixture = parseFullTextLocalFixture({
      capturedAt: "2026-06-12T00:00:00.000Z",
      derivedExtractionTargets: [
        {
          confidence: "Missing",
          field: "duration",
          value: ""
        }
      ],
      sourceId: "credential-risk",
      sourceUrl: "https://user:secret@example.test/full-text?token=1",
      textExcerpt: "Short synthetic excerpt.",
      title: "Credential-risk fixture"
    });
    const report = buildFullTextFixtureReviewReport({ fixture });

    expect(report.blockers).toContain(
      "At least one derived extraction target needs a reviewed value."
    );
    expect(report.blockers).toContain(
      "sourceUrl must not contain credentials, query strings, or fragments."
    );
    expect(report.warnings).toEqual(
      expect.arrayContaining([
        "reviewerNote is empty; add a local operator note before relying on this fixture.",
        "One or more derived targets are missing values and should remain review-only.",
        "One or more derived targets are missing a quoteLocator for local traceability."
      ])
    );
  });

  it("rejects malformed target confidence labels", () => {
    expect(() =>
      parseFullTextLocalFixture({
        capturedAt: "2026-06-12T00:00:00.000Z",
        derivedExtractionTargets: [
          {
            confidence: "Certain",
            field: "outcome",
            value: "Synthetic outcome"
          }
        ],
        sourceId: "bad-confidence",
        sourceUrl: "https://example.test/bad-confidence",
        textExcerpt: "Short synthetic excerpt.",
        title: "Bad confidence"
      })
    ).toThrow("Unsupported full-text fixture confidence: Certain.");
  });
});
