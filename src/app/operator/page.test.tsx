import { OperatorRole, OperatorStatus } from "@prisma/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OperatorBrowserWriteControl } from "@/lib/operator/browser-write-controls";

vi.mock("@/auth", () => ({
  signIn: vi.fn(),
  signOut: vi.fn()
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn()
}));

vi.mock("@/lib/operator/browser-write-actions", () => ({
  extractCandidateStudyFromBrowserForm: vi.fn(),
  linkCandidateClaimFromBrowserForm: vi.fn(),
  promoteCandidateFromBrowserForm: vi.fn(),
  reviewCandidateFromBrowserForm: vi.fn()
}));

vi.mock("@/lib/operator/browser-write-controls", async () => {
  const actual = await vi.importActual<typeof import("@/lib/operator/browser-write-controls")>(
    "@/lib/operator/browser-write-controls"
  );

  return {
    ...actual,
    getOperatorBrowserWriteControlState: vi.fn()
  };
});

vi.mock("@/lib/operator/config", () => ({
  operatorAuthConfigured: vi.fn()
}));

vi.mock("@/lib/operator/review-queue", () => ({
  getOperatorReviewQueueSnapshot: vi.fn()
}));

vi.mock("@/lib/operator/curation-promotion", () => ({
  getSourceCandidatePromotionReadinessSnapshot: vi.fn()
}));

vi.mock("@/lib/operator/audit-trail", () => ({
  getOperatorAuditTrailSnapshot: vi.fn()
}));

vi.mock("@/lib/operator/session", () => ({
  getCurrentOperatorPrincipal: vi.fn()
}));

import OperatorPage from "@/app/operator/page";
import { getOperatorAuditTrailSnapshot } from "@/lib/operator/audit-trail";
import { getOperatorBrowserWriteControlState } from "@/lib/operator/browser-write-controls";
import { operatorAuthConfigured } from "@/lib/operator/config";
import { getSourceCandidatePromotionReadinessSnapshot } from "@/lib/operator/curation-promotion";
import { getOperatorReviewQueueSnapshot } from "@/lib/operator/review-queue";
import { getCurrentOperatorPrincipal } from "@/lib/operator/session";

const auditTrailMock = vi.mocked(getOperatorAuditTrailSnapshot);
const browserControlMock = vi.mocked(getOperatorBrowserWriteControlState);
const operatorAuthConfiguredMock = vi.mocked(operatorAuthConfigured);
const principalMock = vi.mocked(getCurrentOperatorPrincipal);
const promotionReadinessMock = vi.mocked(getSourceCandidatePromotionReadinessSnapshot);
const reviewQueueMock = vi.mocked(getOperatorReviewQueueSnapshot);

describe("OperatorPage role-gated rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    operatorAuthConfiguredMock.mockReturnValue(true);
    principalMock.mockResolvedValue(null);
    browserControlMock.mockImplementation((_principal, control) => lockedControl(control));
    reviewQueueMock.mockResolvedValue(reviewQueueSnapshot());
    promotionReadinessMock.mockResolvedValue(promotionReadinessSnapshot() as never);
    auditTrailMock.mockResolvedValue(auditTrailSnapshot());
  });

  it("renders a closed unavailable state when operator auth is not configured", async () => {
    operatorAuthConfiguredMock.mockReturnValue(false);

    const html = renderToStaticMarkup(await OperatorPage());

    expect(html).toContain("Operator auth unavailable");
    expect(html).not.toContain("Review console");
    expect(reviewQueueMock).not.toHaveBeenCalled();
    expect(promotionReadinessMock).not.toHaveBeenCalled();
    expect(auditTrailMock).not.toHaveBeenCalled();
  });

  it("renders a closed sign-in state for anonymous users", async () => {
    const html = renderToStaticMarkup(await OperatorPage());

    expect(html).toContain("Operator access required");
    expect(html).toContain("Sign in with GitHub");
    expect(html).not.toContain("Candidate review queue");
    expect(html).not.toContain("Audit trail");
  });

  it("shows only the read-only audit trail to active auditors", async () => {
    principalMock.mockResolvedValue(operatorPrincipal(OperatorRole.AUDITOR));

    const html = renderToStaticMarkup(await OperatorPage());

    expect(html).toContain("Review console");
    expect(html).toContain("Audit trail");
    expect(html).toContain("sourceCandidate.reviewDecision");
    expect(html).not.toContain("Candidate review queue");
    expect(html).not.toContain("Promotion readiness");
    expect(html).not.toMatch(/>Accept<\/button>/);
    expect(html).not.toMatch(/>Reject<\/button>/);
    expect(html).not.toContain("Link Claim");
    expect(html).not.toMatch(/>Promote<\/button>/);
    expect(reviewQueueMock).not.toHaveBeenCalled();
    expect(promotionReadinessMock).not.toHaveBeenCalled();
    expect(auditTrailMock).toHaveBeenCalledWith(5);
  });

  it("shows review queue and audit trail to active reviewers without browser write controls", async () => {
    principalMock.mockResolvedValue(operatorPrincipal(OperatorRole.REVIEWER));

    const html = renderToStaticMarkup(await OperatorPage());

    expect(html).toContain("Candidate review queue");
    expect(html).toContain("Creatine and resistance training");
    expect(html).toContain("Audit trail");
    expect(html).not.toContain("Promotion readiness");
    expect(html).not.toMatch(/>Accept<\/button>/);
    expect(html).not.toMatch(/>Reject<\/button>/);
    expect(reviewQueueMock).toHaveBeenCalledWith(5);
    expect(promotionReadinessMock).not.toHaveBeenCalled();
    expect(auditTrailMock).toHaveBeenCalledWith(5);
  });

  it("shows promotion readiness to active admins while write controls remain locked", async () => {
    principalMock.mockResolvedValue(operatorPrincipal(OperatorRole.ADMIN));

    const html = renderToStaticMarkup(await OperatorPage());

    expect(html).toContain("Candidate review queue");
    expect(html).toContain("Promotion readiness");
    expect(html).toContain("Complete claim link before promotion.");
    expect(html).toContain("Audit trail");
    expect(html).not.toMatch(/>Promote<\/button>/);
    expect(reviewQueueMock).toHaveBeenCalledWith(5);
    expect(promotionReadinessMock).toHaveBeenCalledWith(5);
    expect(auditTrailMock).toHaveBeenCalledWith(5);
  });
});

function operatorPrincipal(role: OperatorRole) {
  return {
    email: `${role.toLowerCase()}@example.com`,
    role,
    status: OperatorStatus.ACTIVE,
    userId: `user-${role.toLowerCase()}`
  };
}

function lockedControl(control: OperatorBrowserWriteControl) {
  const permissionByControl = {
    "candidate-review": "candidate:review",
    "claim-link": "curation:claim-link",
    "public-promotion": "evidence:promote",
    "study-extraction": "curation:study-extraction"
  } as const;

  return {
    blockers: ["Browser write controls are not approved."],
    enabled: false,
    evidenceKeys: [],
    permission: permissionByControl[control]
  };
}

function reviewQueueSnapshot() {
  return {
    pendingCount: 1,
    rows: [
      {
        curationStatus: "Claim link missing" as const,
        dedupeKey: "pubmed:creatine:42141930",
        nextAction: "Link accepted reference to candidate claim.",
        publicSourcePacketReady: false,
        source: "PubMed" as const,
        title: "Creatine and resistance training",
        triageReasons: ["High title overlap"],
        triageScore: 87,
        url: "https://pubmed.ncbi.nlm.nih.gov/42141930/"
      }
    ]
  };
}

function promotionReadinessSnapshot() {
  return {
    blockedCount: 1,
    readyCount: 0,
    rows: [
      {
        blockers: ["Claim link missing"],
        candidate: {
          dedupeKey: "pubmed:creatine:42141930",
          externalId: "42141930",
          source: "PubMed",
          title: "Creatine and resistance training"
        },
        nextAction: "Complete claim link before promotion.",
        ready: false,
        status: "Blocked"
      }
    ],
    total: 1
  };
}

function auditTrailSnapshot() {
  return {
    eventCount: 1,
    rows: [
      {
        action: "sourceCandidate.reviewDecision",
        actorEmail: "reviewer@example.com",
        actorRole: "REVIEWER",
        createdAt: "2026-06-11T01:02:03.000Z",
        id: "audit-1",
        notePreview: "Accepted after source packet review.",
        target: "SourceCandidate pubmed:creatine:42141930"
      }
    ]
  };
}
