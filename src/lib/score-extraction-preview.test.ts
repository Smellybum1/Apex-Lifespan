import { describe, expect, it } from "vitest";

import { formatScoreExtractionCandidatePreviewLines } from "@/lib/score-extraction-preview";
import type { ScoreExtractionCandidatePreview } from "@/lib/score-extraction-preview";

describe("formatScoreExtractionCandidatePreviewLines", () => {
  it("includes study source-type flag hints for accepted extraction candidates", () => {
    const preview: ScoreExtractionCandidatePreview = {
      acceptedCandidates: 1,
      blockedCandidates: 0,
      blockerCounts: {
        "claim-link-missing": 0,
        "claim-missing": 0,
        "context-mismatch": 0,
        "existing-extraction": 0,
        "identity-warning": 0
      },
      readyCandidates: 1,
      referenceLimit: 1,
      references: [
        {
          blockedCandidates: 0,
          blockerCounts: {
            "claim-link-missing": 0,
            "claim-missing": 0,
            "context-mismatch": 0,
            "existing-extraction": 0,
            "identity-warning": 0
          },
          candidateCount: 1,
          candidates: [
            {
              acceptedReferenceId: "ref-creatine-rct",
              blockers: [],
              claimId: "creatine-strength",
              claimLinkReady: true,
              curationDraftCommand:
                "npm run ingest:sources -- --candidate-curation-draft b64:creatine",
              dedupeKey: "b64:creatine",
              externalId: "34610729",
              extractionReady: true,
              interventionId: "creatine",
              nextAction: "Ready for operator-reviewed study extraction.",
              reviewStatus: "AI reviewed",
              sourceLabel: "PubMed",
              sourceTextStatus: "Abstract text captured for prefill review.",
              sourceType: "Journal Article, Randomized Controlled Trial",
              studySourceTypeFlagHint: "randomized-controlled-trial",
              title: "Creatine randomized controlled trial",
              triageScore: 75
            }
          ],
          claimCount: 1,
          extractionGaps: ["source type"],
          readyCandidates: 1,
          reference: {
            id: "ref-creatine-rct",
            label: "PubMed PMID: 34610729 2021",
            title: "Creatine randomized controlled trial"
          },
          studyCount: 0
        }
      ],
      scannedReferences: 1,
      totalPendingReferences: 1
    };

    expect(formatScoreExtractionCandidatePreviewLines(preview).join("\n")).toContain(
      "Study-type flag hint: randomized-controlled-trial; verify before writing extraction."
    );
  });
});
