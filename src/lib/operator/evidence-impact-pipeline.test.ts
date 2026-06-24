import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  listSourceCandidateCurationHandoff,
  listSourceCandidateReviewQueue,
  type SourceCandidateCurationStatus
} from "@/lib/data/source-candidates";
import {
  planEvidenceImpactAction,
  runEvidenceImpactPipeline
} from "@/lib/operator/evidence-impact-pipeline";
import type { Reference, SourceCandidate } from "@/lib/types";

vi.mock("@/lib/data/source-candidates", () => ({
  listSourceCandidateCurationHandoff: vi.fn(),
  listSourceCandidateReviewQueue: vi.fn()
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    operatorAuditEvent: {
      findMany: vi.fn()
    },
    user: {
      findMany: vi.fn()
    }
  }
}));

vi.mock("@/lib/operator/curation-promotion", () => ({
  assessSourceCandidatePublicPromotion: vi.fn()
}));

vi.mock("@/lib/operator/source-candidate-actions", () => ({
  linkSourceCandidateClaimAsOperator: vi.fn(),
  promoteSourceCandidatePublicEvidenceAsOperator: vi.fn()
}));

const mockedListSourceCandidateCurationHandoff = vi.mocked(
  listSourceCandidateCurationHandoff
);
const mockedListSourceCandidateReviewQueue = vi.mocked(listSourceCandidateReviewQueue);

const candidate: SourceCandidate = {
  acceptedReferenceId: "ref-pubmed-42141930",
  claimId: "creatine-strength",
  decision: "Accepted",
  dedupeKey: "pubmed|au|creatine strength|42141930|creatine|creatine-strength",
  externalId: "42141930",
  metadata: {},
  query: "creatine strength",
  region: "AU",
  reviewStatus: "AI reviewed",
  source: "PubMed",
  title: "Creatine and resistance training",
  triageReasons: ["High title overlap"],
  triageScore: 87,
  url: "https://pubmed.ncbi.nlm.nih.gov/42141930/"
};

const reference: Reference = {
  id: "ref-pubmed-42141930",
  identifier: "42141930",
  source: "PubMed",
  title: "Creatine and resistance training",
  url: "https://pubmed.ncbi.nlm.nih.gov/42141930/",
  year: 2026
};

describe("evidence impact pipeline planner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedListSourceCandidateCurationHandoff.mockResolvedValue([]);
    mockedListSourceCandidateReviewQueue.mockResolvedValue([]);
  });

  it("plans a claim-link write when the accepted reference and candidate claim are ready", () => {
    expect(
      planEvidenceImpactAction({
        status: curationStatus({
          claimLinks: [],
          publicSourcePacketReady: false,
          status: "Claim link missing",
          studies: []
        })
      })
    ).toMatchObject({
      blockers: [],
      claimId: "creatine-strength",
      kind: "claim-link",
      status: "would-apply",
      writePreview: {
        approvalRequest: expect.objectContaining({
          approvalDecision: "required-before-write-command",
          approvalPhrase: expect.stringContaining(
            "Approve local evidence-impact claim-link apply"
          ),
          approvalScope: expect.arrayContaining([
            "ClaimReference upsert for the accepted reference and candidate claim"
          ]),
          noDatabaseWrite: true,
          requiredInputs: expect.arrayContaining(["--write", "--actor-email"]),
          requiredOperatorPermissions: ["curation:claim-link"],
          status: "approval-required",
          stopConditions: expect.arrayContaining([
            expect.stringContaining("does not explicitly approve")
          ]),
          writes: "none"
        }),
        commandCopy: expect.arrayContaining([
          'npm run evidence:apply-ready -- --write --actor-email "<operator-email>"'
        ]),
        transactionality: "operator-action",
        verification: expect.arrayContaining([
          expect.stringContaining("candidate curation status")
        ]),
        writeScope: expect.arrayContaining([
          "ClaimReference upsert for the accepted reference and candidate claim",
          "operator audit event for sourceCandidate.claimLink"
        ])
      }
    });
  });

  it("blocks claim-link automation before AI or human candidate review", () => {
    expect(
      planEvidenceImpactAction({
        status: curationStatus({
          candidateOverride: {
            reviewStatus: "Unreviewed AI draft"
          },
          claimLinks: [],
          publicSourcePacketReady: false,
          status: "Claim link missing",
          studies: []
        })
      })
    ).toMatchObject({
      blockers: [
        "candidate review status is Unreviewed AI draft; record AI or Human review before curation writes"
      ],
      kind: "blocked",
      status: "blocked"
    });
  });

  it("blocks extraction-pending rows instead of inventing study fields", () => {
    expect(
      planEvidenceImpactAction({
        status: curationStatus({
          claimLinks: [
            {
              claimId: "creatine-strength",
              relevance: 5
            }
          ],
          publicSourcePacketReady: false,
          status: "Extraction pending",
          studies: []
        })
      })
    ).toMatchObject({
      blockers: [
        "Structured extraction still needs source-backed sample size, population, outcomes, safety, funding/conflict, and risk-of-bias fields."
      ],
      kind: "extraction-needed",
      status: "blocked"
    });
  });

  it("plans public promotion only after readiness passes", () => {
    expect(
      planEvidenceImpactAction({
        promotionReady: true,
        status: curationStatus({
          claimLinks: [
            {
              claimId: "creatine-strength",
              relevance: 5
            }
          ],
          publicSourcePacketReady: true,
          status: "Public source packet ready",
          studies: [
            {
              id: "study-creatine",
              referenceId: reference.id,
              title: reference.title,
              year: 2026
            }
          ]
        })
      })
    ).toMatchObject({
      blockers: [],
      kind: "public-promotion",
      status: "would-apply",
      writePreview: {
        approvalRequest: expect.objectContaining({
          approvalDecision: "required-before-write-command",
          approvalPhrase: expect.stringContaining(
            "Approve local evidence-impact public-promotion apply"
          ),
          approvalScope: expect.arrayContaining([
            "PublicChangelogEntry create with publishedAt null"
          ]),
          noDatabaseWrite: true,
          requiredInputs: expect.arrayContaining(["--write", "--actor-email"]),
          requiredOperatorPermissions: ["evidence:promote"],
          status: "approval-required",
          stopConditions: expect.arrayContaining([
            expect.stringContaining("does not explicitly approve")
          ]),
          writes: "none"
        }),
        preWriteChecks: expect.arrayContaining([
          "promotion dry-run reports a ready public source packet"
        ]),
        transactionality: "single-transaction",
        verification: expect.arrayContaining([
          "review event, score snapshot, score history, unpublished changelog entry, and operator audit event were created"
        ]),
        writeScope: expect.arrayContaining([
          "ReviewEvent create",
          "ClaimScoreSnapshot create",
          "ClaimScoreHistory create",
          "PublicChangelogEntry create with publishedAt null",
          "operator audit event for sourceCandidate.publicEvidencePromotion"
        ])
      }
    });
  });

  it("runs a no-DB ready public-promotion fixture dry run", async () => {
    const result = await runEvidenceImpactPipeline({
      fixture: "ready-public-promotion"
    });

    expect(mockedListSourceCandidateCurationHandoff).not.toHaveBeenCalled();
    expect(mockedListSourceCandidateReviewQueue).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      dryRun: true,
      summary: {
        applied: 0,
        blocked: 0,
        scanned: 1,
        skipped: 0,
        upstreamLeads: 0,
        wouldApply: 1
      },
      warnings: [
        expect.stringContaining("Fixture mode")
      ]
    });
    expect(result.wouldApply[0]).toMatchObject({
      claimId: "creatine-strength",
      kind: "public-promotion",
      source: "PubMed",
      status: "would-apply",
      writePreview: expect.objectContaining({
        approvalRequest: expect.objectContaining({
          approvalDecision: "required-before-write-command",
          noDatabaseWrite: true,
          requiredInputs: expect.arrayContaining([
            "promotion dry-run ready packet",
            "reviewStatus=AI reviewed"
          ]),
          requiredOperatorPermissions: ["evidence:promote"],
          writes: "none"
        }),
        commandCopy: expect.arrayContaining([
          "npm run evidence:apply-ready -- --json"
        ]),
        transactionality: "single-transaction",
        verification: expect.arrayContaining([
          "public changelog remains unpublished until a separate publication approval"
        ]),
        writeScope: expect.arrayContaining([
          "ClaimScoreSnapshot create",
          "ClaimScoreHistory create",
          "PublicChangelogEntry create with publishedAt null"
        ])
      })
    });
  });

  it("refuses write mode for the no-DB fixture", async () => {
    await expect(
      runEvidenceImpactPipeline({
        fixture: "ready-public-promotion",
        write: true
      })
    ).rejects.toThrow("fixture mode is dry-run only");
  });

  it("skips already-promoted rows by default", () => {
    expect(
      planEvidenceImpactAction({
        alreadyPromoted: true,
        promotionReady: true,
        status: curationStatus({
          claimLinks: [
            {
              claimId: "creatine-strength",
              relevance: 5
            }
          ],
          publicSourcePacketReady: true,
          status: "Public source packet ready",
          studies: [
            {
              id: "study-creatine",
              referenceId: reference.id,
              title: reference.title,
              year: 2026
            }
          ]
        })
      })
    ).toMatchObject({
      blockers: [],
      kind: "already-promoted",
      status: "skipped"
    });
  });

  it("surfaces upstream candidate leads without applying decisions or promotion", async () => {
    mockedListSourceCandidateReviewQueue.mockResolvedValue([
      {
        ...candidate,
        acceptedReferenceId: undefined,
        decision: "Pending review",
        reviewStatus: "Unreviewed AI draft"
      }
    ]);

    const result = await runEvidenceImpactPipeline({ upstreamLimit: 1 });

    expect(mockedListSourceCandidateReviewQueue).toHaveBeenCalledWith({ limit: 1 });
    expect(result.summary).toMatchObject({
      applied: 0,
      blocked: 0,
      scanned: 0,
      upstreamLeads: 1,
      wouldApply: 0
    });
    expect(result.upstreamLeads).toEqual([
      expect.objectContaining({
        claimId: "creatine-strength",
        command: expect.stringContaining("--candidate-review-packet b64:"),
        decision: "Pending review",
        noAutomaticCandidateDecision: true,
        noAutomaticExtractionWrite: true,
        noAutomaticPromotion: true,
        reason: expect.stringContaining("explicit Codex/operator review"),
        referenceMatchesCommand: expect.stringContaining(
          "--candidate-reference-matches b64:"
        ),
        reviewStatus: "Unreviewed AI draft",
        source: "PubMed"
      })
    ]);
  });

  it("returns an empty read-only fallback when dry-run cannot reach the database", async () => {
    mockedListSourceCandidateCurationHandoff.mockRejectedValue(
      new Error("Can't reach database server at `localhost:5432`")
    );

    const result = await runEvidenceImpactPipeline();

    expect(result).toMatchObject({
      dryRun: true,
      summary: {
        applied: 0,
        blocked: 0,
        scanned: 0,
        skipped: 0,
        upstreamLeads: 0,
        wouldApply: 0
      },
      warnings: [
        expect.stringContaining("Database is not reachable")
      ]
    });
  });

  it("does not hide database reachability failures in write mode", async () => {
    mockedListSourceCandidateCurationHandoff.mockRejectedValue(
      new Error("Can't reach database server at `localhost:5432`")
    );

    await expect(runEvidenceImpactPipeline({ write: true })).rejects.toThrow(
      "Can't reach database server"
    );
  });
});

function curationStatus(
  overrides: Pick<
    SourceCandidateCurationStatus,
    "claimLinks" | "publicSourcePacketReady" | "status" | "studies"
  > & {
    candidateOverride?: Partial<SourceCandidate>;
  }
): SourceCandidateCurationStatus {
  const statusCandidate = {
    ...candidate,
    ...overrides.candidateOverride
  };

  return {
    acceptedReference: reference,
    acceptedReferenceId: reference.id,
    candidate: statusCandidate,
    candidateClaimLinked: overrides.claimLinks.some(
      (link) => link.claimId === statusCandidate.claimId
    ),
    claimLinks: overrides.claimLinks,
    nextAction: "Review curation status.",
    publicSourcePacketReady: overrides.publicSourcePacketReady,
    status: overrides.status,
    studies: overrides.studies
  };
}
