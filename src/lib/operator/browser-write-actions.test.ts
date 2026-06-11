import { OperatorRole, OperatorStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  extractSourceCandidateStudyAsOperator,
  linkSourceCandidateClaimAsOperator,
  promoteSourceCandidatePublicEvidenceAsOperator,
  reviewSourceCandidateAsOperator
} from "@/lib/operator/source-candidate-actions";
import {
  extractCandidateStudyFromBrowserForm,
  linkCandidateClaimFromBrowserForm,
  promoteCandidateFromBrowserForm,
  reviewCandidateFromBrowserForm
} from "@/lib/operator/browser-write-actions";
import type { OperatorBrowserWriteControlEnv } from "@/lib/operator/browser-write-controls";
import type { OperatorPrincipal } from "@/lib/operator/authorization";

vi.mock("@/lib/operator/source-candidate-actions", () => ({
  extractSourceCandidateStudyAsOperator: vi.fn(),
  linkSourceCandidateClaimAsOperator: vi.fn(),
  promoteSourceCandidatePublicEvidenceAsOperator: vi.fn(),
  reviewSourceCandidateAsOperator: vi.fn()
}));

const reviewMock = vi.mocked(reviewSourceCandidateAsOperator);
const linkMock = vi.mocked(linkSourceCandidateClaimAsOperator);
const extractMock = vi.mocked(extractSourceCandidateStudyAsOperator);
const promoteMock = vi.mocked(promoteSourceCandidatePublicEvidenceAsOperator);

const admin: OperatorPrincipal = {
  email: "admin@example.test",
  role: OperatorRole.ADMIN,
  status: OperatorStatus.ACTIVE,
  userId: "user-admin"
};

const approvedEnv: OperatorBrowserWriteControlEnv = {
  APEX_OPERATOR_BROWSER_WRITE_CONTROLS_APPROVED_AT: "2026-06-11T12:00:00Z",
  APEX_OPERATOR_FLOW_QA_REVIEWED_AT: "2026-06-11T11:00:00Z",
  APEX_OPERATOR_NONPROD_WRITE_QA_AT: "2026-06-11T10:00:00Z",
  APEX_OPERATOR_WRITES_ENABLED: "true"
};

describe("operator browser write action parsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reviewMock.mockResolvedValue({ ok: true } as never);
    linkMock.mockResolvedValue({ ok: true } as never);
    extractMock.mockResolvedValue({ ok: true } as never);
    promoteMock.mockResolvedValue({ ok: true } as never);
  });

  it("fails closed before calling write wrappers when browser controls are not approved", async () => {
    const formData = new FormData();
    formData.set("dedupeKey", "candidate-1");
    formData.set("decision", "Rejected");
    formData.set("reviewNote", "Out of scope.");

    await expect(reviewCandidateFromBrowserForm(admin, formData, {})).rejects.toThrow(
      "Operator browser write control is not enabled"
    );
    expect(reviewMock).not.toHaveBeenCalled();
  });

  it("parses accept and reject review forms", async () => {
    const accept = new FormData();
    accept.set("acceptedReferenceId", "ref-pubmed-42141930");
    accept.set("decision", "Accepted");
    accept.set("dedupeKey", "candidate-1");
    accept.set("reviewNote", "Matches the scoped claim.");

    await reviewCandidateFromBrowserForm(admin, accept, approvedEnv);

    expect(reviewMock).toHaveBeenCalledWith(
      admin,
      {
        acceptedReferenceId: "ref-pubmed-42141930",
        decision: "Accepted",
        dedupeKey: "candidate-1",
        reviewNote: "Matches the scoped claim."
      },
      approvedEnv
    );

    const reject = new FormData();
    reject.set("decision", "Rejected");
    reject.set("dedupeKey", "candidate-2");
    reject.set("reviewNote", "Not relevant.");

    await reviewCandidateFromBrowserForm(admin, reject, approvedEnv);

    expect(reviewMock).toHaveBeenCalledWith(
      admin,
      {
        decision: "Rejected",
        dedupeKey: "candidate-2",
        reviewNote: "Not relevant."
      },
      approvedEnv
    );
  });

  it("parses claim-link and study-extraction forms", async () => {
    const claimLink = new FormData();
    claimLink.set("dedupeKey", "candidate-1");
    claimLink.set("note", "Claim context checked.");
    claimLink.set("relevance", "5");

    await linkCandidateClaimFromBrowserForm(admin, claimLink, approvedEnv);

    expect(linkMock).toHaveBeenCalledWith(
      admin,
      {
        dedupeKey: "candidate-1",
        note: "Claim context checked.",
        relevance: 5
      },
      approvedEnv
    );

    const extraction = new FormData();
    extraction.set("adverseEvents", "No serious adverse events extracted.");
    extraction.set("dedupeKey", "candidate-1");
    extraction.set("fundingConflicts", "Not extracted.");
    extraction.set("interventionName", "Creatine monohydrate");
    extraction.set("outcomes", "Strength, Lean mass");
    extraction.set("population", "Adults in resistance training studies.");
    extraction.set("riskOfBias", "Not assessed.");
    extraction.set("sampleSize", "Systematic review.");

    await extractCandidateStudyFromBrowserForm(admin, extraction, approvedEnv);

    expect(extractMock).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({
        dedupeKey: "candidate-1",
        interventionName: "Creatine monohydrate",
        outcomes: ["Strength", "Lean mass"],
        population: "Adults in resistance training studies."
      }),
      approvedEnv
    );
  });

  it("parses promotion forms only after browser controls are approved", async () => {
    const promotion = new FormData();
    promotion.set("dedupeKey", "candidate-1");
    promotion.set("promotionNote", "Human reviewed the ready source packet.");

    await promoteCandidateFromBrowserForm(admin, promotion, approvedEnv);

    expect(promoteMock).toHaveBeenCalledWith(
      admin,
      {
        dedupeKey: "candidate-1",
        promotionNote: "Human reviewed the ready source packet."
      },
      approvedEnv
    );
  });
});
