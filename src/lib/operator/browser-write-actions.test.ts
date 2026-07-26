import { OperatorRole, OperatorStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  extractSourceCandidateStudyAsOperator,
  linkSourceCandidateClaimAsOperator,
  promoteSourceCandidatePublicEvidenceAsOperator,
  reviewSourceCandidateAsOperator
} from "@/lib/operator/source-candidate-actions";
import {
  importSupplementOnboardingDraftAsOperator,
  saveSupplementOnboardingDraftAsOperator
} from "@/lib/operator/supplement-onboarding-drafts";
import { updateClaimScoreAsOperator } from "@/lib/operator/claim-score-update";
import {
  extractCandidateStudyFromBrowserForm,
  importOnboardingDraftFromBrowserForm,
  linkCandidateClaimFromBrowserForm,
  promoteCandidateFromBrowserForm,
  reviewCandidateFromBrowserForm,
  saveOnboardingDraftFromBrowserForm,
  updateClaimScoreFromBrowserForm
} from "@/lib/operator/browser-write-actions";
import type { OperatorBrowserWriteControlEnv } from "@/lib/operator/browser-write-controls";
import type { OperatorPrincipal } from "@/lib/operator/authorization";

vi.mock("@/lib/operator/source-candidate-actions", () => ({
  extractSourceCandidateStudyAsOperator: vi.fn(),
  linkSourceCandidateClaimAsOperator: vi.fn(),
  promoteSourceCandidatePublicEvidenceAsOperator: vi.fn(),
  reviewSourceCandidateAsOperator: vi.fn()
}));

vi.mock("@/lib/operator/supplement-onboarding-drafts", () => ({
  importSupplementOnboardingDraftAsOperator: vi.fn(),
  saveSupplementOnboardingDraftAsOperator: vi.fn()
}));

vi.mock("@/lib/operator/claim-score-update", () => ({
  updateClaimScoreAsOperator: vi.fn()
}));

const reviewMock = vi.mocked(reviewSourceCandidateAsOperator);
const linkMock = vi.mocked(linkSourceCandidateClaimAsOperator);
const extractMock = vi.mocked(extractSourceCandidateStudyAsOperator);
const promoteMock = vi.mocked(promoteSourceCandidatePublicEvidenceAsOperator);
const importDraftMock = vi.mocked(importSupplementOnboardingDraftAsOperator);
const saveDraftMock = vi.mocked(saveSupplementOnboardingDraftAsOperator);
const updateScoreMock = vi.mocked(updateClaimScoreAsOperator);

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

const approvedImportEnv: OperatorBrowserWriteControlEnv = {
  ...approvedEnv,
  APEX_ONBOARDING_DATABASE_IMPORT_ENABLED: "true",
  APEX_ONBOARDING_DATABASE_IMPORT_REVIEWED_AT: "2026-06-13T01:00:00Z"
};

describe("operator browser write action parsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reviewMock.mockResolvedValue({ ok: true } as never);
    linkMock.mockResolvedValue({ ok: true } as never);
    extractMock.mockResolvedValue({ ok: true } as never);
    promoteMock.mockResolvedValue({ ok: true } as never);
    importDraftMock.mockResolvedValue({ ok: true } as never);
    saveDraftMock.mockResolvedValue({ ok: true } as never);
    updateScoreMock.mockResolvedValue({ ok: true } as never);
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
        reviewNote: "Matches the scoped claim.",
        reviewedBy: "human"
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
        reviewNote: "Not relevant.",
        reviewedBy: "human"
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
    extraction.set("abstract", "Abstract summary reviewed.");
    extraction.set("dedupeKey", "candidate-1");
    extraction.set("duration", "12 weeks");
    extraction.set("fundingConflicts", "Not extracted.");
    extraction.set("interventionName", "Creatine monohydrate");
    extraction.set("mainResults", "Strength improved.");
    extraction.set("outcomes", "Strength, Lean mass");
    extraction.set("population", "Adults in resistance training studies.");
    extraction.set("riskOfBias", "Not assessed.");
    extraction.set("sampleSize", "Systematic review.");

    await extractCandidateStudyFromBrowserForm(admin, extraction, approvedEnv);

    expect(extractMock).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({
        dedupeKey: "candidate-1",
        abstract: "Abstract summary reviewed.",
        duration: "12 weeks",
        interventionName: "Creatine monohydrate",
        mainResults: "Strength improved.",
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

  it("parses claim score update forms with dry-run and apply gates", async () => {
    const dryRun = new FormData();
    dryRun.set("claimId", "creatine-strength");
    dryRun.set("effectSize", "7");
    dryRun.set("evidenceDirectness", "8");
    dryRun.set("evidenceRigor", "7");
    dryRun.set("finalLabel", "Useful for Specific Use Case");
    dryRun.set("hypePenalty", "2");
    dryRun.set("measurability", "6");
    dryRun.set("mode", "dry-run");
    dryRun.set("productQuality", "6");
    dryRun.set("rationale", "Preview source packet scoring.");
    dryRun.set("regulatoryRisk", "3");
    dryRun.set("safety", "8");

    await updateClaimScoreFromBrowserForm(admin, dryRun, {});

    expect(updateScoreMock).toHaveBeenCalledWith(
      admin,
      {
        claimId: "creatine-strength",
        dryRun: true,
        finalLabel: "Useful for Specific Use Case",
        rationale: "Preview source packet scoring.",
        scores: {
          effectSize: 7,
          evidenceDirectness: 8,
          evidenceRigor: 7,
          hypePenalty: 2,
          measurability: 6,
          productQuality: 6,
          regulatoryRisk: 3,
          safety: 8
        }
      },
      {}
    );

    const apply = new FormData();
    for (const [key, value] of dryRun.entries()) {
      if (typeof value === "string") {
        apply.set(key, value);
      }
    }
    apply.set("mode", "apply");
    apply.set("rationale", "Apply reviewed source packet scoring.");

    await expect(updateClaimScoreFromBrowserForm(admin, apply, {})).rejects.toThrow(
      "Operator browser write control is not enabled"
    );
    await updateClaimScoreFromBrowserForm(admin, apply, approvedEnv);

    expect(updateScoreMock).toHaveBeenLastCalledWith(
      admin,
      expect.objectContaining({
        dryRun: false,
        rationale: "Apply reviewed source packet scoring."
      }),
      approvedEnv
    );
  });

  it("parses onboarding draft forms only after browser controls are approved", async () => {
    const locked = new FormData();
    locked.set("name", "Magnesium glycinate");

    await expect(saveOnboardingDraftFromBrowserForm(admin, locked, {})).rejects.toThrow(
      "Operator browser write control is not enabled"
    );
    expect(saveDraftMock).not.toHaveBeenCalled();

    const draft = new FormData();
    draft.set("category", "Vitamin/mineral");
    draft.append("claimTemplateIds", "sleep");
    draft.append("claimTemplateIds", "safety");
    draft.set("commonForms", "capsule, powder");
    draft.set("customClaimOutcome", "Mood/stress");
    draft.set("customClaimText", "Stress resilience support.");
    draft.set("name", "Magnesium glycinate");
    draft.set("note", "Operator draft save.");
    draft.set("productAustNumber", "AUST L 123456");
    draft.set("productBrand", "Example Brand");
    draft.set("productName", "Example Magnesium Glycinate");
    draft.set("productSourceUrl", "https://example.test/artg-product");
    draft.set("productSponsor", "Example Sponsor Pty Ltd");
    draft.set("region", "AU");
    draft.set("synonyms", "magnesium\nMg");

    await saveOnboardingDraftFromBrowserForm(admin, draft, approvedEnv);

    expect(saveDraftMock).toHaveBeenCalledWith(
      admin,
      {
        category: "Vitamin/mineral",
        claimTemplateIds: ["sleep", "safety"],
        claims: [
          {
            claimText: "Stress resilience support.",
            outcome: "Mood/stress"
          }
        ],
        commonForms: ["capsule", "powder"],
        name: "Magnesium glycinate",
        note: "Operator draft save.",
        product: {
          artgId: undefined,
          austNumber: "AUST L 123456",
          brand: "Example Brand",
          name: "Example Magnesium Glycinate",
          sourceUrl: "https://example.test/artg-product",
          sponsor: "Example Sponsor Pty Ltd"
        },
        region: "AU",
        synonyms: ["magnesium", "Mg"]
      },
      approvedEnv
    );
  });

  it("parses onboarding database import forms only after import controls are approved", async () => {
    const locked = new FormData();
    locked.set("draftId", "draft-1");
    locked.set("importNote", "Reviewed database import readiness.");

    await expect(
      importOnboardingDraftFromBrowserForm(admin, locked, approvedEnv)
    ).rejects.toThrow("Operator browser write control is not enabled");
    expect(importDraftMock).not.toHaveBeenCalled();

    const approved = new FormData();
    approved.set("draftId", "draft-1");
    approved.set("importNote", "Reviewed database import readiness.");

    await importOnboardingDraftFromBrowserForm(admin, approved, approvedImportEnv);

    expect(importDraftMock).toHaveBeenCalledWith(
      admin,
      {
        draftId: "draft-1",
        importNote: "Reviewed database import readiness."
      },
      approvedImportEnv
    );
  });
});
