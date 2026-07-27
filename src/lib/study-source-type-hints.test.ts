import { describe, expect, it } from "vitest";

import {
  formatStudySourceTypeCommandHints,
  studySourceTypeCommandHintFromText
} from "@/lib/study-source-type-hints";

describe("study source type command hints", () => {
  it("maps captured candidate source types onto ingest command values", () => {
    expect(studySourceTypeCommandHintFromText("Journal Article, Meta-Analysis")).toBe(
      "meta-analysis"
    );
    expect(
      studySourceTypeCommandHintFromText("Journal Article, Randomized Controlled Trial")
    ).toBe("randomized-controlled-trial");
    expect(studySourceTypeCommandHintFromText("Clinical trial record")).toBe(
      "clinical-trial-record"
    );
    expect(studySourceTypeCommandHintFromText("Observational Cohort")).toBe(
      "observational-cohort"
    );
  });

  it("deduplicates and sorts multiple command hints", () => {
    expect(
      formatStudySourceTypeCommandHints([
        "Randomized Controlled Trial",
        "Journal Article, Meta-Analysis",
        "Randomized Controlled Trial"
      ])
    ).toBe("meta-analysis; randomized-controlled-trial");
  });

  it("falls back to manual verification when source type text is not specific enough", () => {
    expect(formatStudySourceTypeCommandHints(["Journal Article", null])).toBe(
      "verify-source-type"
    );
  });
});
