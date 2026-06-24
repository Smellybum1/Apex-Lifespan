import { describe, expect, it } from "vitest";

import {
  formatSourceCandidateCommandIndex,
  listSourceCandidateCommandIndex
} from "@/lib/data/source-candidate-command-index";

describe("source-candidate command index", () => {
  it("returns read-only commands before write commands by default", () => {
    const entries = listSourceCandidateCommandIndex({ limit: 3 });

    expect(entries).toHaveLength(3);
    expect(entries.every((entry) => entry.mode === "read-only")).toBe(true);
  });

  it("filters by mode and query with compact command metadata", () => {
    const entries = listSourceCandidateCommandIndex({
      mode: "explicit-write-after-approval",
      query: "extract study",
      limit: 2
    });

    expect(entries[0]).toMatchObject({
      id: "extract-candidate-study",
      mode: "explicit-write-after-approval"
    });
    expect(entries[0].guardrail).toContain("Explicit structured extraction write");
  });

  it("formats a copy-safe command index without loading CLI implementation output", () => {
    const text = formatSourceCandidateCommandIndex(
      listSourceCandidateCommandIndex({ query: "curation handoff", limit: 1 })
    );

    expect(text).toContain("Source-candidate command index");
    expect(text).toContain("Candidate curation handoff");
    expect(text).toContain("npm run ingest:sources -- --candidate-curation-handoff");
  });
});
