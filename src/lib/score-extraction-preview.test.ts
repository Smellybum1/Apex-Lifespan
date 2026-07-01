import { ReviewStatus as DbReviewStatus, SourceKind as DbSourceKind } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildScoreExtractionCandidatePreview,
  formatScoreExtractionCandidatePreviewLines
} from "@/lib/score-extraction-preview";
import type { ScoreExtractionCandidatePreview } from "@/lib/score-extraction-preview";
import type {
  ScoreWorklistPendingReferenceGroup,
  ScoreWorklistRepairSummary
} from "@/lib/score-worklist";

const prismaMocks = vi.hoisted(() => ({
  claimReferenceFindManyMock: vi.fn(),
  sourceCandidateFindManyMock: vi.fn(),
  studyGroupByMock: vi.fn()
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    claimReference: {
      findMany: prismaMocks.claimReferenceFindManyMock
    },
    sourceCandidate: {
      findMany: prismaMocks.sourceCandidateFindManyMock
    },
    study: {
      groupBy: prismaMocks.studyGroupByMock
    }
  }
}));

beforeEach(() => {
  prismaMocks.sourceCandidateFindManyMock.mockResolvedValue([]);
  prismaMocks.claimReferenceFindManyMock.mockResolvedValue([]);
  prismaMocks.studyGroupByMock.mockResolvedValue([]);
});

describe("buildScoreExtractionCandidatePreview", () => {
  it("scans identity-clean extraction references before identity-warning references", async () => {
    const summary = scoreRepairSummary([
      pendingReferenceGroup("ready-reference", []),
      pendingReferenceGroup("identity-warning-reference", ["Identity needs review."])
    ]);
    prismaMocks.sourceCandidateFindManyMock.mockResolvedValue([
      {
        acceptedReferenceId: "ready-reference",
        claimId: "wrong-claim",
        dedupeKey: "blocked-candidate",
        externalId: "99999999",
        interventionId: "creatine",
        metadata: {},
        reviewStatus: DbReviewStatus.HUMAN_REVIEWED,
        source: DbSourceKind.PUBMED,
        sourceType: "Journal Article, Randomized Controlled Trial",
        title: "Higher triage but blocked candidate",
        triageScore: 99
      },
      {
        acceptedReferenceId: "ready-reference",
        claimId: "creatine-strength",
        dedupeKey: "ready-candidate",
        externalId: "34610729",
        interventionId: "creatine",
        metadata: {
          abstractText: "Creatine abstract."
        },
        reviewStatus: DbReviewStatus.HUMAN_REVIEWED,
        source: DbSourceKind.PUBMED,
        sourceType: "Journal Article, Randomized Controlled Trial",
        title: "Ready creatine candidate",
        triageScore: 75
      }
    ]);
    prismaMocks.claimReferenceFindManyMock.mockResolvedValue([
      {
        claimId: "creatine-strength",
        referenceId: "ready-reference"
      }
    ]);

    const preview = await buildScoreExtractionCandidatePreview(summary, {
      referenceLimit: 5
    });

    expect(prismaMocks.sourceCandidateFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          acceptedReferenceId: {
            in: ["ready-reference"]
          }
        })
      })
    );
    expect(preview.scannedReferences).toBe(1);
    expect(preview.totalPendingReferences).toBe(1);
    expect(preview.identityBlockedReferences).toBe(1);
    expect(preview.identityBlockedClaimLinks).toBe(1);
    expect(preview.references[0]?.repairReferenceCommand).toBe(
      "npx tsx scripts/local-score-worklist.ts --repair-reference ready-reference"
    );
    expect(preview.references[0]?.primaryCandidate).toMatchObject({
      curationDraftCommand: `npm run ingest:sources -- --candidate-curation-draft ${safeCandidateKey(
        "ready-candidate"
      )}`,
      label: "PubMed 34610729",
      reason: "ready, source text captured, Human reviewed; verify before extraction"
    });
    expect(preview.references[0]?.candidates[0]?.dedupeKey).toBe(safeCandidateKey("ready-candidate"));
  });
});

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
      identityBlockedClaimLinks: 2,
      identityBlockedReferences: 2,
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
          primaryCandidate: {
            curationDraftCommand:
              "npm run ingest:sources -- --candidate-curation-draft b64:creatine",
            label: "PubMed 34610729",
            reason: "ready, source text captured, AI reviewed; verify before extraction"
          },
          readyCandidates: 1,
          repairReferenceCommand:
            "npx tsx scripts/local-score-worklist.ts --repair-reference ref-creatine-rct",
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
    const lines = formatScoreExtractionCandidatePreviewLines(preview).join("\n");

    expect(lines).toContain(
      "Study-type flag hint: randomized-controlled-trial; verify before writing extraction."
    );
    expect(lines).toContain(
      "Repair brief: npx tsx scripts/local-score-worklist.ts --repair-reference ref-creatine-rct"
    );
    expect(lines).toContain(
      "Start draft: npm run ingest:sources -- --candidate-curation-draft b64:creatine (ready, source text captured, AI reviewed; verify before extraction)"
    );
    expect(lines).toContain("scanned 1/1 extraction-ready reference(s); 2 identity-blocked skipped");
    expect(lines).toContain("Skipped identity cleanup: 2 reference group(s) / 2 claim-link(s).");
  });
});

function scoreRepairSummary(
  pendingReferenceGroups: ScoreWorklistPendingReferenceGroup[]
): ScoreWorklistRepairSummary {
  const identityWarningGroups = pendingReferenceGroups.filter(
    (group) => group.identityWarnings.length > 0
  );

  return {
    blockerBreakdown: [],
    extractionPendingRows: pendingReferenceGroups.length,
    extractionReadyReferenceClaimLinks: pendingReferenceGroups.length - identityWarningGroups.length,
    extractionReadyReferenceGroups: pendingReferenceGroups.length - identityWarningGroups.length,
    identityWarningReferenceClaimLinks: identityWarningGroups.length,
    identityWarningReferenceGroups: identityWarningGroups.length,
    missingReferenceGroups: [],
    missingSourceRows: 0,
    pendingReferenceGroups,
    sourceBlockedRows: pendingReferenceGroups.length,
    unlinkedInterventionGroups: [],
    unlinkedRows: 0
  };
}

function safeCandidateKey(dedupeKey: string) {
  return `b64:${Buffer.from(dedupeKey, "utf8").toString("base64url")}`;
}

function pendingReferenceGroup(
  referenceId: string,
  identityWarnings: string[]
): ScoreWorklistPendingReferenceGroup {
  return {
    claimCount: 1,
    extractionGaps: [],
    highestPriority: 100,
    identityWarnings,
    interventions: [
      {
        claimCount: 1,
        id: "creatine",
        name: "Creatine monohydrate",
        slug: "creatine"
      }
    ],
    outcomes: ["Muscle/strength"],
    priority: 100,
    reference: {
      id: referenceId,
      label: referenceId,
      source: "PubMed",
      title: `${referenceId} title`,
      url: `https://example.test/${referenceId}`
    },
    sampleClaims: [
      {
        claimId: "creatine-strength",
        interventionName: "Creatine monohydrate",
        outcome: "Muscle/strength",
        priorityLabel: "High"
      }
    ]
  };
}
