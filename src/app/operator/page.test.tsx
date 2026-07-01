import {
  OperatorRole,
  OperatorStatus,
  SupplementOnboardingDraftStatus
} from "@prisma/client";
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
  importOnboardingDraftFromBrowserForm: vi.fn(),
  linkCandidateClaimFromBrowserForm: vi.fn(),
  promoteCandidateFromBrowserForm: vi.fn(),
  updateClaimScoreFromBrowserForm: vi.fn(),
  reviewCandidateFromBrowserForm: vi.fn(),
  saveOnboardingDraftFromBrowserForm: vi.fn()
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

vi.mock("@/lib/operator/onboarding-quality", () => ({
  getOperatorOnboardingQualitySnapshot: vi.fn()
}));

vi.mock("@/lib/operator/supplement-onboarding-drafts", () => ({
  getSupplementOnboardingDraftReviewSnapshot: vi.fn()
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

vi.mock("@/lib/data/dashboard", async () => {
  const seed = await vi.importActual<typeof import("@/lib/seed-data")>("@/lib/seed-data");

  return {
    getEvidenceDashboardData: vi.fn(async () => ({
      australiaRegulatoryStatuses: seed.australiaRegulatoryStatuses,
      claims: seed.claims,
      dataSource: "seed",
      interventions: seed.interventions,
      productSignals: seed.productSignals,
      references: seed.references,
      safetyAlerts: seed.safetyAlerts,
      studies: seed.studies,
      trialWatchItems: seed.trialWatchItems
    }))
  };
});

import OperatorPage from "@/app/operator/page";
import { getOperatorAuditTrailSnapshot } from "@/lib/operator/audit-trail";
import { getOperatorBrowserWriteControlState } from "@/lib/operator/browser-write-controls";
import { operatorAuthConfigured } from "@/lib/operator/config";
import { getSourceCandidatePromotionReadinessSnapshot } from "@/lib/operator/curation-promotion";
import { getOperatorOnboardingQualitySnapshot } from "@/lib/operator/onboarding-quality";
import { getOperatorReviewQueueSnapshot } from "@/lib/operator/review-queue";
import { getCurrentOperatorPrincipal } from "@/lib/operator/session";
import { getSupplementOnboardingDraftReviewSnapshot } from "@/lib/operator/supplement-onboarding-drafts";

const auditTrailMock = vi.mocked(getOperatorAuditTrailSnapshot);
const browserControlMock = vi.mocked(getOperatorBrowserWriteControlState);
const draftReviewMock = vi.mocked(getSupplementOnboardingDraftReviewSnapshot);
const onboardingQualityMock = vi.mocked(getOperatorOnboardingQualitySnapshot);
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
    draftReviewMock.mockResolvedValue(savedDraftSnapshot());
    onboardingQualityMock.mockResolvedValue(onboardingQualitySnapshot() as never);
    promotionReadinessMock.mockResolvedValue(promotionReadinessSnapshot() as never);
    auditTrailMock.mockResolvedValue(auditTrailSnapshot());
  });

  it("renders a closed unavailable state when operator auth is not configured", async () => {
    operatorAuthConfiguredMock.mockReturnValue(false);

    const html = renderToStaticMarkup(await OperatorPage());

    expect(html).toContain("Operator auth unavailable");
    expect(html).not.toContain("Review console");
    expect(reviewQueueMock).not.toHaveBeenCalled();
    expect(draftReviewMock).not.toHaveBeenCalled();
    expect(onboardingQualityMock).not.toHaveBeenCalled();
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
    expect(html).not.toContain("Onboarding quality");
    expect(html).not.toContain("Supplement draft");
    expect(html).not.toContain("Candidate review queue");
    expect(html).not.toContain("Promotion readiness");
    expect(html).not.toMatch(/>Accept<\/button>/);
    expect(html).not.toMatch(/>Reject<\/button>/);
    expect(html).not.toContain("Link Claim");
    expect(html).not.toMatch(/>Promote<\/button>/);
    expect(reviewQueueMock).not.toHaveBeenCalled();
    expect(onboardingQualityMock).not.toHaveBeenCalled();
    expect(promotionReadinessMock).not.toHaveBeenCalled();
    expect(draftReviewMock).not.toHaveBeenCalled();
    expect(auditTrailMock).toHaveBeenCalledWith(5);
  });

  it("shows review queue and audit trail to active reviewers without browser write controls", async () => {
    principalMock.mockResolvedValue(operatorPrincipal(OperatorRole.REVIEWER));

    const html = renderToStaticMarkup(await OperatorPage());

    expect(html).toContain("Onboarding quality");
    expect(html).toContain("Post-onboarding monitor");
    expect(html).toContain("Full-text source gate:");
    expect(html).toContain("Refresh policy: routine");
    expect(html).toContain("Guided onboarding workflow");
    expect(html).toContain("Ready check");
    expect(html).toContain("Run promotion readiness before any explicit public promotion.");
    expect(html).toContain("Full-text source gate");
    expect(html).toContain("Priority queue");
    expect(html).toContain("promotion review");
    expect(html).toContain("Creatine");
    expect(html).toContain("2 high");
    expect(html).toContain("Full-text gate");
    expect(html).toContain("Full-text source gate: 3 blocked");
    expect(html).toContain("Full-text inventory progress");
    expect(html).toContain("0 ready, 0 in progress, 0 premature approval, 3 not started.");
    expect(html).toContain("Connector review draft");
    expect(html).toContain("0 ready for review, 2 blocked, 1 hold.");
    expect(html).toContain("No connector approval:");
    expect(html).toContain("Connector approval packet");
    expect(html).toContain("0 ready for approval, 2 blocked, 1 hold.");
    expect(html).toContain("Approval granted:");
    expect(html).toContain("No implementation approval:");
    expect(html).not.toContain("Supplement draft");
    expect(html).not.toContain("Saved supplement drafts");
    expect(html).toContain("Candidate review queue");
    expect(html).toContain("Creatine and resistance training");
    expect(html).toContain("Autopilot priority");
    expect(html).toContain("review first");
    expect(html).toContain("candidate-curation-draft");
    expect(html).toContain("Packet preview:");
    expect(html).toContain("candidate-review-packet");
    expect(html).toContain("Reference matches:");
    expect(html).toContain("candidate-reference-matches");
    expect(html).toContain("Preview read-only:");
    expect(html).toContain("No auto accept:");
    expect(html).toContain("Audit trail");
    expect(html).not.toContain("Promotion readiness");
    expect(html).not.toMatch(/>Accept<\/button>/);
    expect(html).not.toMatch(/>Reject<\/button>/);
    expect(reviewQueueMock).toHaveBeenCalledWith(5);
    expect(draftReviewMock).not.toHaveBeenCalled();
    expect(onboardingQualityMock).toHaveBeenCalledWith(6);
    expect(promotionReadinessMock).not.toHaveBeenCalled();
    expect(auditTrailMock).toHaveBeenCalledWith(5);
  });

  it("shows promotion readiness to active admins while write controls remain locked", async () => {
    principalMock.mockResolvedValue(operatorPrincipal(OperatorRole.ADMIN));

    const html = renderToStaticMarkup(await OperatorPage());

    expect(html).toContain("Candidate review queue");
    expect(html).toContain("Supplement draft");
    expect(html).toContain("Saved supplement drafts");
    expect(html).toContain("Magnesium glycinate");
    expect(html).toContain("Manual seed copy");
    expect(html).toContain("Database import: future gated");
    expect(html).toContain("Operator import action:");
    expect(html).toContain("permission: onboarding:import");
    expect(html).toContain("Import locked:");
    expect(html).toContain("Import Draft");
    expect(html).toContain("No auto-write: true");
    expect(html).toContain("Guided onboarding workflow");
    expect(html).toContain("Private draft review");
    expect(html).toContain("onboarding:import-assistant");
    expect(html).toContain("No database write: true");
    expect(html).toContain("Product identity");
    expect(html).toContain("AUST number");
    expect(html).toContain("Onboarding quality");
    expect(html).toContain("Post-onboarding monitor");
    expect(html).toContain("No visible maintenance issue for this supplement.");
    expect(html).toContain("High attention");
    expect(html).toContain("Batch progress");
    expect(html).toContain("Review promotion readiness diffs before any explicit promotion action.");
    expect(html).toContain("Full-text gate");
    expect(html).toContain("Source next step");
    expect(html).toContain("create inventory template");
    expect(html).toContain("npm run onboarding:fulltext-sources -- --write-template");
    expect(html).toContain("Full-text inventory progress");
    expect(html).toContain("Connector review draft");
    expect(html).toContain("Connector approval packet");
    expect(html).toContain("Safety signals");
    expect(html).toContain("Review diff");
    expect(html).toContain("Decision support");
    expect(html).toContain("Candidate review autopilot");
    expect(html).toContain("Autopilot next:");
    expect(html).toContain("No auto accept:");
    expect(html).toContain("Promotion readiness");
    expect(html).toContain("Dry run:");
    expect(html).toContain("Permission: evidence:promote");
    expect(html).toContain("Score field editor");
    expect(html).toContain("Ready-first scoring pass");
    expect(html).toContain("Loaded now");
    expect(html).toContain("Ready now");
    expect(html).toContain("Source work");
    expect(html).toContain("Source repair queue");
    expect(html).toContain("Extraction pending");
    expect(html).toContain("Missing source records");
    expect(html).toContain("Unlinked claims");
    expect(html).toContain("Reference groups");
    expect(html).toContain("Reference briefs are read-only");
    expect(html).toContain("npx tsx scripts/local-score-worklist.ts");
    expect(html).toContain("--repair-reference");
    expect(html).toContain("unless a human explicitly confirms otherwise");
    expect(html).toContain("Complete claim link before promotion.");
    expect(html).toContain("Audit trail");
    expect(html).not.toMatch(/>Promote<\/button>/);
    expect(reviewQueueMock).toHaveBeenCalledWith(5);
    expect(draftReviewMock).toHaveBeenCalledWith(5);
    expect(onboardingQualityMock).toHaveBeenCalledWith(6);
    expect(promotionReadinessMock).toHaveBeenCalledWith(5);
    expect(auditTrailMock).toHaveBeenCalledWith(5);
  });

  it("shows full-text fixture follow-up command previews to operators", async () => {
    principalMock.mockResolvedValue(operatorPrincipal(OperatorRole.ADMIN));
    const snapshot = onboardingQualitySnapshot();
    snapshot.fullTextNextAction = {
      ...snapshot.fullTextNextAction,
      commands: [
        {
          command:
            "npm run onboarding:fulltext-fixture -- --fixture-dir docs/codex/onboarding/fulltext-fixtures --progress --summary",
          id: "check-fixture-progress",
          label: "Check fixture starter progress",
          mode: "read-only",
          purpose:
            "Summarize generated local fixture starter states without reading from live sources."
        },
        {
          command:
            "npm run onboarding:fulltext-fixture -- --fixture-file docs/codex/onboarding/fulltext-fixtures/pmc-open-access.local.json --summary",
          id: "validate-fixture-starter",
          label: "Validate local fixture starter",
          mode: "read-only",
          purpose:
            "Check the generated local fixture starter after reviewed local values are filled."
        },
        {
          command:
            "npm run onboarding:fulltext-fixture -- --fixture-file docs/codex/onboarding/fulltext-fixtures/pmc-open-access.local.json --extraction-draft --candidate-key <accepted-candidate-dedupe-key> --study-source-type randomized-controlled-trial --summary",
          id: "draft-fixture-extraction",
          label: "Preview fixture extraction draft",
          mode: "read-only",
          purpose:
            "Map reviewed local fixture fields into a command draft without writing extraction rows."
        }
      ],
      nextAction:
        "Open connector prep, then review local fixture starter progress before any extraction write.",
      selectedSource: {
        approvalWarnings: [],
        connectorReviewStatus: "ready-for-review",
        id: "pmc-open-access",
        label: "PubMed Central Open Access subset",
        missingRequiredFields: [],
        progressStatus: "ready-for-connector-review",
        tier: "start-here"
      },
      status: "open-connector-review"
    };
    onboardingQualityMock.mockResolvedValue(snapshot as never);

    const html = renderToStaticMarkup(await OperatorPage());

    expect(html).toContain("Fixture follow-ups");
    expect(html).toContain("Check fixture starter progress");
    expect(html).toContain("Validate local fixture starter");
    expect(html).toContain("Preview fixture extraction draft");
    expect(html).toContain("--fixture-dir docs/codex/onboarding/fulltext-fixtures --progress --summary");
    expect(html).toContain("--fixture-file docs/codex/onboarding/fulltext-fixtures/pmc-open-access.local.json --summary");
    expect(html).toContain("--extraction-draft");
    expect(html).toContain("No extraction write: true");
  });

  it("shows extraction prefill suggestions when browser write controls are approved", async () => {
    principalMock.mockResolvedValue(operatorPrincipal(OperatorRole.ADMIN));
    browserControlMock.mockImplementation((_principal, control) => enabledControl(control));

    const html = renderToStaticMarkup(await OperatorPage());

    expect(html).toContain("Extract Study");
    expect(html).toContain("Prefill suggestions");
    expect(html).toContain("Abstract/source summary");
    expect(html).toContain("Abstract/source summary (Strong)");
    expect(html).toContain("PubMed abstract: Creatine source summary.");
    expect(html).toContain("120 actual");
    expect(html).toContain("Weak (candidate-metadata)");
    expect(html).toMatch(/>Save Extraction<\/button>/);
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
    "onboarding-draft": "onboarding:draft",
    "onboarding-import": "onboarding:import",
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
        autopilot: {
          curationDraftCommand:
            'npm run ingest:sources -- --candidate-curation-draft "pubmed:creatine:42141930"',
          nextAction:
            "Review this candidate first for accepted-reference matching and claim fit.",
          noAutoAccept: true as const,
          noAutoExtraction: true as const,
          noAutoPromotion: true as const,
          noAutoReject: true as const,
          priority: 4,
          rationale: [
            "high-repute source with high conviction (87/100).",
            "Strong traceability and relevance signals make this a first-pass review candidate."
          ],
          recommendation: "review-first" as const,
          sourceConvictionScore: 87,
          sourceReputationLabel: "high-repute"
        },
        curationStatus: "Claim link missing" as const,
        dedupeKey: "pubmed:creatine:42141930",
        nextAction: "Link accepted reference to candidate claim.",
        packetPreview: {
          candidateReviewPacketCommand:
            'npm run ingest:sources -- --candidate-review-packet "pubmed:creatine:42141930"',
          curationStatusCommand:
            'npm run ingest:sources -- --candidate-curation-status "pubmed:creatine:42141930"',
          noCandidateDecision: true as const,
          noExtractionWrite: true as const,
          noPromotion: true as const,
          readOnly: true as const,
          referenceMatchesCommand:
            'npm run ingest:sources -- --candidate-reference-matches "pubmed:creatine:42141930"',
          siblingsCommand:
            'npm run ingest:sources -- --candidate-siblings "pubmed:creatine:42141930"'
        },
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
        actionPreview: {
          browserAction:
            "Resolve promotion blockers before the browser promotion action is usable.",
          dryRunCommand:
            "npm run promotion:dry-run -- pubmed%3Acreatine%3A42141930",
          promotionEffect:
            "No public packet write preview until accepted reference, claim link, structured extraction, and packet readiness are complete.",
          requiredPermission: "evidence:promote" as const
        },
        extractionPrefill: {
          curationDraftCommand:
            "npm run ingest:sources -- --candidate-curation-draft pubmed%3Acreatine%3A42141930",
          fieldSuggestions: [
            {
              confidence: "candidate-metadata" as const,
              confidenceLabel: "Strong",
              confidenceRationale:
                "Value comes directly from captured source metadata or source-text preview, but still needs operator verification.",
              field: "abstract",
              label: "Abstract/source summary",
              note:
                "Captured abstract or registry summary can seed the optional study abstract field, but operators must verify source context before writing.",
              reviewConfidence: "strong" as const,
              value: "PubMed abstract: Creatine source summary.",
              writeFlag: "--study-abstract"
            },
            {
              confidence: "candidate-metadata" as const,
              confidenceLabel: "Weak",
              confidenceRationale:
                "Value comes from broad candidate metadata and may not match the analyzed study field exactly.",
              field: "sampleSize",
              label: "Sample size",
              note:
                "Enrollment/sample-size metadata may describe planned rather than analyzed sample; verify actual analyzed sample before writing.",
              reviewConfidence: "weak" as const,
              value: "120 actual",
              writeFlag: "--study-sample-size"
            }
          ],
          fullTextStatus:
            "Full text is not automatically captured; operators must verify the source packet before writing extraction fields.",
          sourceTextStatus: "PubMed abstract text captured for the curation draft."
        },
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

function enabledControl(control: OperatorBrowserWriteControl) {
  return {
    ...lockedControl(control),
    blockers: [],
    enabled: true,
    evidenceKeys: ["APEX_OPERATOR_FLOW_QA_REVIEWED_AT"]
  };
}

function savedDraftSnapshot() {
  return {
    generatedAt: "2026-06-12T01:02:03.000Z",
    humanOwned: true as const,
    limit: 5,
    noAutoPromotion: true as const,
    noAutoWrite: true as const,
    noDatabaseWrite: true as const,
    noPublicEvidenceRowsWritten: true as const,
    readOnly: true as const,
    rows: [
      {
        blockerCount: 0,
        claimCount: 1,
        createdByEmail: "admin@example.com",
        databaseImportAction: {
          blockerCount: 0,
          blockers: [],
          claimCount: 1,
          claimIds: ["magnesium-glycinate-sleep"],
          enabledWhenGateSatisfied: true,
          importedRowPreview: {
            australiaRegulatoryStatuses: 1 as const,
            claims: 1,
            interventions: 1 as const
          },
          interventionId: "magnesium-glycinate",
          nextAction:
            "Review warnings, confirm draft public visibility is acceptable, then use the gated operator import action with an import note.",
          noAutoPromotion: true as const,
          noCandidateDecision: true as const,
          noClaimReview: true as const,
          noConnectorApproval: true as const,
          noExtractionWrite: true as const,
          noFullTextFetch: true as const,
          permission: "onboarding:import" as const,
          publicVisibilityWarning:
            "Database-backed public dashboards may display imported rows as unreviewed draft claims; import only after accepting that draft status, uncertainty labels, and AU/TGA Unknown framing are appropriate.",
          regulatoryStatusId: "magnesium-glycinate-au-status",
          requiresImportNote: true as const,
          requiresOperatorBrowserGate: true as const,
          status: "review-required" as const,
          supportedNow: true as const,
          warnings: [
            "1 AU/TGA product-status gap(s) remain; keep regulatory kind Unknown until reviewed."
          ]
        },
        draftStatus: SupplementOnboardingDraftStatus.DRAFT,
        id: "draft-1",
        importPlan: {
          databaseImport: {
            nextAction:
              "Keep saved operator drafts private for now; a future database import action must be separately implemented, operator-gated, audited, and reviewed before it can create intervention or claim rows.",
            noImportCommand: true as const,
            requiredFutureGate:
              "Explicit authenticated operator database-import implementation and review.",
            status: "future-gated" as const,
            supportedNow: false as const
          },
          nextAction:
            "Complete manual copy review, then copy accepted snippets into src/lib/seed-data.ts and run validation. Database import remains future-gated.",
          noAutoPromotion: true as const,
          noAutoWrite: true as const,
          noDatabaseWrite: true as const,
          noPublicEvidenceRowsWritten: true as const,
          recommendedPath: "manual-seed-copy" as const,
          seedCopy: {
            nextAction:
              "Complete manual copy review, then copy accepted snippets into src/lib/seed-data.ts and run validation.",
            operations: [],
            reviewRequired: true,
            status: "review-required" as const,
            targetPath: "src/lib/seed-data.ts" as const
          },
          status: "review-required" as const,
          validationCommands: [
            "npm run db:validate",
            "npm run typecheck",
            "npm run test",
            "npm run build"
          ]
        },
        name: "Magnesium glycinate",
        nextAction:
          "Complete manual copy review, then copy accepted snippets into src/lib/seed-data.ts and run validation.",
        privateDraft: true as const,
        readOnly: true as const,
        slug: "magnesium-glycinate",
        updatedAt: "2026-06-12T01:02:03.000Z",
        warningCount: 1
      }
    ],
    summary: {
      blocked: 0,
      databaseImportBlocked: 0,
      databaseImportReady: 0,
      databaseImportReviewRequired: 1,
      databaseImportSupported: true as const,
      drafts: 1,
      readyForManualSeedCopy: 0,
      reviewRequired: 1
    }
  };
}

function onboardingQualitySnapshot() {
  return {
    dataSource: "database",
    generatedAt: "2026-06-12T01:02:03.000Z",
    humanOwned: true,
    fullTextSources: {
      blocked: [
        {
          blockers: ["Terms of use have not been reviewed."],
          id: "pmc-open-access",
          label: "PubMed Central Open Access subset",
          nextAction:
            "Review source terms, robots/API policy, retention, derived export, and live-fetch approval before enabling full-text capture."
        }
      ],
      counts: {
        blockedSources: 3,
        dryRunSupportedSources: 1,
        holdSources: 1,
        liveApprovedSources: 0,
        startHereSources: 1,
        sources: 3
      },
      fixtureContract: {
        derivedFieldsOnly: true,
        localOnly: true,
        nextAction: "Use operator-provided local fixtures to validate parsing shape before any live connector work.",
        rawTextStored: false,
        status: "ready",
        supportedInput: "operator-local-fixture"
      },
      generatedAt: "2026-06-12T01:02:03.000Z",
      liveCaptureReady: false,
      nextAction:
        "Review source terms, robots/API policy, retention, derived export, and live-fetch approval before enabling full-text capture.",
      readOnly: true,
      reviewQueue: [
        {
          convictionScore: 55,
          id: "pmc-open-access",
          label: "PubMed Central Open Access subset",
          limitations: ["Terms of use have not been reviewed."],
          missingRequiredFields: ["Terms URL"],
          nextAction:
            "Review source terms, robots/API policy, retention, derived export, and live-fetch approval before enabling full-text capture.",
          positiveFactors: ["High-repute biomedical source class."],
          reviewPriority: 10,
          sourceReputation: "high",
          tier: "start-here"
        }
      ]
    },
    fullTextNextAction: {
      commands: [
        {
          command:
            "npm run onboarding:fulltext-sources -- --write-template docs/codex/onboarding/fulltext-source-inventory.local.json",
          id: "write-inventory-template",
          label: "Create source inventory template",
          mode: "local-file-write",
          purpose:
            "Write a user-owned inventory starter with all approvals false and no live fetch enabled."
        }
      ],
      generatedAt: "2026-06-12T01:02:03.000Z",
      humanOwned: true,
      inventoryFilePath: "docs/codex/onboarding/fulltext-source-inventory.local.json",
      inventoryFileProvided: false,
      nextAction:
        "Create a user-owned full-text source inventory from the safe template, then fill one source worksheet before rerunning the gate.",
      noAutoApproval: true,
      noConnectorApproval: true,
      noLiveFetch: true,
      readOnly: true,
      selectedSource: {
        approvalWarnings: [],
        connectorReviewStatus: "blocked",
        id: "pmc-open-access",
        label: "PubMed Central Open Access subset",
        missingRequiredFields: ["Terms URL"],
        progressStatus: "not-started",
        tier: "start-here"
      },
      status: "create-inventory-template",
      summary: {
        blockedSources: 3,
        changedSources: 0,
        connectorReadyForReviewSources: 0,
        inProgressSources: 0,
        notStartedSources: 3,
        prematureApprovalSources: 0,
        readyForConnectorReviewSources: 0,
        sources: 3
      }
    },
    fullTextProgress: {
      generatedAt: "2026-06-12T01:02:03.000Z",
      humanOwned: true,
      liveCaptureReady: false,
      nextAction:
        "Start from the worksheet or template and fill reviewed terms, access, rate/cache, retention, and export evidence.",
      noAutoApproval: true,
      noLiveFetch: true,
      readOnly: true,
      rows: [
        {
          approvalWarnings: [],
          changedFields: [],
          completedRequiredFields: 1,
          id: "pmc-open-access",
          label: "PubMed Central Open Access subset",
          missingRequiredFields: ["Terms URL"],
          nextAction:
            "Start from the worksheet or template and fill reviewed terms, access, rate/cache, retention, and export evidence.",
          status: "not-started",
          tier: "start-here",
          totalRequiredFields: 14
        }
      ],
      summary: {
        changedSources: 0,
        inProgressSources: 0,
        notStartedSources: 3,
        prematureApprovalSources: 0,
        readyForConnectorReviewSources: 0,
        sources: 3
      }
    },
    fullTextConnectorReview: {
      generatedAt: "2026-06-12T01:02:03.000Z",
      humanOwned: true,
      nextAction: "Terms URL is incomplete.",
      noAutoApproval: true,
      noConnectorApproval: true,
      noLiveFetch: true,
      readOnly: true,
      rows: [
        {
          blockers: ["Terms URL is incomplete."],
          connectorKey: "pmc-open-access",
          id: "pmc-open-access",
          label: "PubMed Central Open Access subset",
          nextAction: "Terms URL is incomplete.",
          reviewStatus: "blocked",
          tier: "start-here"
        }
      ],
      summary: {
        blockedSources: 2,
        holdSources: 1,
        readyForReviewSources: 0,
        sources: 3
      }
    },
    fullTextConnectorApproval: {
      approvalGranted: false,
      generatedAt: "2026-06-12T01:02:03.000Z",
      humanOwned: true,
      nextAction: "Terms URL is incomplete.",
      noAutoApproval: true,
      noConnectorApproval: true,
      noImplementationApproval: true,
      noLiveFetch: true,
      noNetworkFetch: true,
      readOnly: true,
      rows: [
        {
          approvalGranted: false,
          blockers: ["Terms URL is incomplete."],
          connectorKey: "pmc-open-access",
          id: "pmc-open-access",
          implementationStatus: "blocked",
          incompleteApprovalItems: [
            "Connector review ready",
            "Fixture-first implementation plan ready"
          ],
          label: "PubMed Central Open Access subset",
          nextAction: "Terms URL is incomplete.",
          reviewStatus: "blocked",
          status: "blocked"
        }
      ],
      summary: {
        blockedSources: 2,
        holdSources: 1,
        readyForApprovalSources: 0,
        sources: 3
      }
    },
    monitor: {
      generatedAt: "2026-06-12T01:02:03.000Z",
      globalIssues: [
        {
          command: "npm run onboarding:fulltext-sources -- --next --summary",
          count: 3,
          detail:
            "3 full-text source class(es) remain blocked; no live full-text connector is approved.",
          kind: "full-text-gate-blocked",
          label: "Full-text source gate",
          nextAction:
            "Review source terms, access, retention, and derived-only export before any connector implementation.",
          severity: "warning"
        }
      ],
      humanOwned: true,
      nextAction:
        "Review source terms, access, retention, and derived-only export before any connector implementation.",
      noAutoPromotion: true,
      noAutoReview: true,
      noAutoWrite: true,
      noCandidateDecision: true,
      noDatabaseWrite: true,
      noExtractionWrite: true,
      noPublicEvidenceRowsWritten: true,
      readOnly: true,
      rows: [
        {
          humanOwned: true,
          issues: [],
          nextAction:
            "Keep this supplement in periodic source, safety, and product-status monitoring.",
          noAutoPromotion: true,
          noAutoReview: true,
          noAutoWrite: true,
          noCandidateDecision: true,
          noDatabaseWrite: true,
          noExtractionWrite: true,
          noPublicEvidenceRowsWritten: true,
          oldestReviewEvidenceDate: "2026-06-12",
          readOnly: true,
          refreshPolicy: {
            intervalDays: 365,
            rationale: [
              "Routine reviewed supplement packets start with a 365-day refresh interval."
            ],
            tier: "routine"
          },
          reviewAgeDays: 0,
          staleAfterDays: 365,
          status: "ready",
          supplement: {
            category: "Amino acid",
            id: "creatine-monohydrate",
            name: "Creatine",
            slug: "creatine"
          }
        }
      ],
      staleAfterDays: 365,
      summary: {
        actionNeededSupplements: 0,
        extractionGapSupplements: 0,
        fullTextGateBlocked: true,
        globalIssues: 1,
        highAttentionCadenceSupplements: 0,
        missingProductStatusSupplements: 0,
        pendingCandidateSupplements: 0,
        promotionReadySupplements: 0,
        readySupplements: 1,
        routineCadenceSupplements: 1,
        safetySignalSupplements: 0,
        sourceTrackingUnavailable: false,
        staleReviewSupplements: 0,
        supplements: 1,
        unknownProductStatusSupplements: 0,
        unreviewedClaimSupplements: 0,
        watchCadenceSupplements: 0,
        watchSupplements: 0
      }
    },
    nextAction: "Ready for explicit operator-owned review or promotion checks.",
    priorityQueue: [
      {
        action: "Review promotion readiness diffs before any explicit promotion action.",
        blockers: 0,
        category: "Amino acid",
        claims: 2,
        id: "creatine-monohydrate",
        name: "Creatine",
        pendingCandidates: 0,
        priority: 60,
        promotionReadyClaims: 2,
        rationale: [
          "ready onboarding status.",
          "2/2 claim(s) are promotion-review ready."
        ],
        safetySignals: 0,
        slug: "creatine",
        status: "ready",
        tier: "promotion-review",
        warnings: 0
      }
    ],
    readOnly: true,
    rows: [
      {
        blockers: [],
        counts: {
          acceptedCandidates: 1,
          claims: 2,
          pendingCandidates: 0,
          rejectedCandidates: 0,
          reviewedCandidates: 1,
          reviewedClaims: 2,
          safetySignals: 0,
          sourceCandidates: 2,
          sourceJobs: 2
        },
        convictionDistribution: {
          high: 2,
          low: 0,
          moderate: 0,
          unscored: 0,
          veryLow: 0
        },
        nextAction: "Ready for explicit operator-owned review or promotion checks.",
        promotion: {
          blockedClaims: 0,
          blockers: [],
          readyClaims: 2,
          totalClaims: 2
        },
        reviewPacketDiff: {
          publicWordingChanges: 0,
          referenceLinkChanges: 0,
          scoreChanges: 0,
          uncertaintyLabelChanges: 0
        },
        reviewPacketDecision: {
          holdOrReject: 0,
          needsMoreEvidence: 0,
          readyForHumanReview: 2
        },
        reviewPacketAutopilot: {
          blockedBySafety: 0,
          nextAction:
            "No pending or limitation-first candidates remain; continue with explicit packet review and separate promotion diff review.",
          noAutoAccept: true,
          noAutoExtraction: true,
          noAutoPromotion: true,
          noAutoReject: true,
          readyNoPendingCandidates: 2,
          reviewPendingCandidate: 0,
          summarizeLimitations: 0
        },
        sourcePacket: {
          completeClaims: 2,
          extractionPendingClaims: 0,
          extractedReferences: 2,
          missingReferences: 0,
          missingSourceClaims: 0,
          pendingReferences: 0,
          totalReferences: 2,
          unlinkedClaims: 0
        },
        status: "ready",
        states: {
          candidates: "found",
          draft: "reviewed",
          extraction: "complete",
          promotion: "ready",
          queue: "completed",
          reviewPacket: "complete"
        },
        supplement: {
          category: "Amino acid",
          id: "creatine-monohydrate",
          name: "Creatine",
          slug: "creatine"
        },
        warnings: []
      }
    ],
    sourceTracking: {
      status: "available"
    },
    summary: {
      acceptedCandidates: 1,
      blockedSupplements: 0,
      candidates: 2,
      extractionCompleteClaims: 2,
      pendingCandidates: 0,
      promotionBlockedClaims: 0,
      promotionReadyClaims: 2,
      queuedJobs: 0,
      readySupplements: 1,
      reviewedCandidates: 1,
      reviewedClaims: 2,
      safetySignals: 0,
      sourceJobs: 2,
      supplements: 1,
      totalClaims: 2,
      warningSupplements: 0
    }
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
