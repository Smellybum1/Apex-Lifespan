import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildFullTextConnectorApprovalPacket,
  buildFullTextConnectorPrepKit,
  buildFullTextConnectorReviewDraft,
  buildFullTextSourceFixtureScenarioMatrix,
  buildFullTextSourceInventoryNextActionPlan,
  buildFullTextSourceInventoryTemplate,
  buildFullTextSourceInventoryProgressReport,
  buildFullTextSourceReadinessReport,
  buildFullTextSourceReviewKit,
  buildFullTextSourceReviewWorksheet,
  buildFullTextConnectorImplementationPlan,
  fullTextConnectorApprovalPacketToMarkdown,
  fullTextConnectorReviewDraftToMarkdown,
  fullTextConnectorImplementationPlanToMarkdown,
  fullTextSourceReviewWorksheetToMarkdown,
  parseFullTextSourceInventory,
  summarizeFullTextConnectorApprovalPacket,
  summarizeFullTextSourceFixtureScenarioMatrix,
  summarizeFullTextSourceInventoryNextActionPlan,
  summarizeFullTextConnectorImplementationPlan,
  summarizeFullTextConnectorReviewDraft,
  summarizeFullTextSourceInventoryProgressReport,
  summarizeFullTextSourceReadinessReport
} from "@/lib/full-text-source-readiness";

describe("full text source readiness", () => {
  it("blocks live capture by default while exposing a local fixture contract", () => {
    const report = buildFullTextSourceReadinessReport({
      generatedAt: new Date("2026-06-12T00:00:00.000Z")
    });

    expect(report).toMatchObject({
      fixtureContract: {
        derivedOnly: true,
        rawTextStored: false,
        status: "ready",
        supportedInput: "operator-local-fixture"
      },
      generatedAt: "2026-06-12T00:00:00.000Z",
      humanOwned: true,
      liveCaptureReady: false,
      readOnly: true,
      summary: {
        blockedSources: 3,
        dryRunSupportedSources: 1,
        holdSources: 1,
        liveApprovedSources: 0,
        startHereSources: 1,
        sources: 3
      }
    });
    expect(report.rows.every((row) => row.status === "blocked")).toBe(true);
    expect(report.rows[0]?.sourceConviction).toMatchObject({
      sourceReputation: "high",
      tier: "start-here"
    });
    expect(report.rows[1]?.sourceConviction).toMatchObject({
      sourceReputation: "moderate",
      tier: "hold"
    });
    expect(report.rows[2]?.sourceConviction).toMatchObject({
      sourceReputation: "manual-only",
      tier: "fixture-only"
    });
    expect(report.rows[0]?.blockers).toContain("Terms URL is missing.");
    expect(report.rows[0]?.blockers).toContain(
      "Live full-text fetch is not approved or supported."
    );
    expect(report.rows[2]?.warnings).toContain(
      "Private/local source packet risk; raw text must stay local and reviewed."
    );
  });

  it("marks a custom source ready only after every review gate is satisfied", () => {
    const report = buildFullTextSourceReadinessReport({
      generatedAt: new Date("2026-06-12T00:00:00.000Z"),
      inventory: [
        {
          accessMethod: "api",
          allowedUse: "Open-access full-text capture for reviewed records only.",
          approval: {
            accessMethodReviewed: true,
            approvedForLiveFetch: true,
            approvedForPublicExport: true,
            approvedForStorage: true,
            derivedOnlyExportReviewed: true,
            rawRetentionReviewed: true,
            robotsOrApiPolicyReviewed: true,
            termsReviewed: true
          },
          authRequired: false,
          cacheTtl: "24h",
          captchaRisk: false,
          dryRunSupported: true,
          id: "reviewed-source",
          label: "Reviewed source",
          liveFetchSupported: true,
          loginRequired: false,
          notes: "Reviewed fixture source.",
          policyUrl: "https://example.test/policy",
          privateDataRisk: false,
          rateLimit: "1 request/second",
          rawRetentionPolicy: "Local raw text deleted after extraction review.",
          reviewedAt: "2026-06-12",
          reviewedBy: "operator",
          sourceKind: "biomedical-literature",
          termsUrl: "https://example.test/terms"
        }
      ]
    });

    expect(report.liveCaptureReady).toBe(true);
    expect(report.rows).toEqual([
      expect.objectContaining({
        blockers: [],
        id: "reviewed-source",
        nextAction:
          "Source approval is complete; implement any live connector in a separate explicit review step.",
        sourceConviction: expect.objectContaining({
          convictionScore: 100,
          missingRequiredFields: [],
          tier: "start-here"
        }),
        status: "ready",
        warnings: []
      })
    ]);
  });

  it("parses user-owned JSON inventory without granting missing approvals", () => {
    const inventory = parseFullTextSourceInventory({
      sources: [
        {
          accessMethod: "manual-local-file",
          allowedUse: "Local packet fixture only.",
          approval: {
            termsReviewed: true
          },
          dryRunSupported: true,
          id: "local-packet",
          label: "Local packet",
          sourceKind: "operator-local-fixture"
        }
      ]
    });

    const report = buildFullTextSourceReadinessReport({ inventory });

    expect(report.rows[0]).toMatchObject({
      blockers: expect.arrayContaining([
        "Robots/API policy URL is missing.",
        "Access method is not reviewed.",
        "Live full-text fetch is not approved or supported."
      ]),
      dryRunSupported: true,
      id: "local-packet",
      status: "blocked"
    });
  });

  it("summarizes blocked source actions without exposing row internals", () => {
    const report = buildFullTextSourceReadinessReport({
      generatedAt: new Date("2026-06-12T00:00:00.000Z")
    });
    const summary = summarizeFullTextSourceReadinessReport(report);

    expect(summary).toMatchObject({
      counts: report.summary,
      generatedAt: "2026-06-12T00:00:00.000Z",
      liveCaptureReady: false,
      readOnly: true
    });
    expect(summary.blocked).toHaveLength(3);
    expect(summary.reviewQueue.map((item) => item.id)).toEqual([
      "pmc-open-access",
      "operator-local-source-packet",
      "publisher-hosted-full-text"
    ]);
    expect(summary.reviewQueue[0]).toMatchObject({
      sourceReputation: "high",
      tier: "start-here"
    });
    expect(JSON.stringify(summary)).not.toContain('"rows"');
  });

  it("builds a user-owned inventory template with approvals unset", () => {
    const template = buildFullTextSourceInventoryTemplate({
      generatedAt: new Date("2026-06-12T00:00:00.000Z")
    });

    expect(template).toMatchObject({
      generatedAt: "2026-06-12T00:00:00.000Z",
      humanOwned: true,
      readOnly: true
    });
    expect(template.sources).toHaveLength(3);
    expect(template.sources[0]).toMatchObject({
      approval: {
        accessMethodReviewed: false,
        approvedForLiveFetch: false,
        approvedForPublicExport: false,
        approvedForStorage: false,
        derivedOnlyExportReviewed: false,
        rawRetentionReviewed: false,
        robotsOrApiPolicyReviewed: false,
        termsReviewed: false
      },
      liveFetchSupported: false,
      reviewedAt: "",
      reviewedBy: ""
    });
    expect(template.reviewChecklist.map((item) => item.field)).toEqual(
      expect.arrayContaining([
        "termsUrl",
        "policyUrl",
        "approval.approvedForLiveFetch",
        "approval.approvedForPublicExport"
      ])
    );
  });

  it("builds a read-only review worksheet for the top source without granting approvals", () => {
    const worksheet = buildFullTextSourceReviewWorksheet({
      generatedAt: new Date("2026-06-12T00:00:00.000Z")
    });

    expect(worksheet).toMatchObject({
      generatedAt: "2026-06-12T00:00:00.000Z",
      humanOwned: true,
      noAutoApproval: true,
      noLiveFetch: true,
      readOnly: true,
      source: {
        id: "pmc-open-access",
        sourceReputation: "high",
        tier: "start-here"
      }
    });
    expect(worksheet.reviewFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          complete: false,
          currentValue: "",
          field: "termsUrl",
          label: "Terms URL"
        }),
        expect.objectContaining({
          complete: false,
          currentValue: false,
          field: "approval.approvedForLiveFetch"
        })
      ])
    );
    expect(worksheet.safeInventoryEntry).toMatchObject({
      approval: {
        approvedForLiveFetch: false,
        approvedForPublicExport: false,
        approvedForStorage: false,
        termsReviewed: false
      },
      liveFetchSupported: false,
      reviewedAt: "",
      reviewedBy: ""
    });
  });

  it("builds a focused worksheet for a selected source id", () => {
    const worksheet = buildFullTextSourceReviewWorksheet({
      sourceId: "operator-local-source-packet"
    });

    expect(worksheet).toMatchObject({
      source: {
        id: "operator-local-source-packet",
        sourceReputation: "manual-only",
        tier: "fixture-only"
      }
    });
    expect(worksheet.reviewFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          complete: true,
          currentValue: "n/a",
          field: "rateLimit"
        }),
        expect.objectContaining({
          complete: true,
          currentValue: "no shared cache",
          field: "cacheTtl"
        })
      ])
    );
  });

  it("renders the worksheet as markdown with a safe inventory starter", () => {
    const worksheet = buildFullTextSourceReviewWorksheet({
      generatedAt: new Date("2026-06-12T00:00:00.000Z")
    });
    const markdown = fullTextSourceReviewWorksheetToMarkdown(worksheet);

    expect(markdown).toContain("# Full-Text Source Review Worksheet");
    expect(markdown).toContain("No auto approval: true");
    expect(markdown).toContain("Source-conviction score:");
    expect(markdown).toContain("| Terms URL | - | no |");
    expect(markdown).toContain("## Safe Inventory Starter");
    expect(markdown).toContain('"approvedForLiveFetch": false');
  });

  it("builds a local review kit without granting source or connector approval", () => {
    const kit = buildFullTextSourceReviewKit({
      generatedAt: new Date("2026-06-12T00:00:00.000Z"),
      outputDir: "docs/codex/onboarding/review-kit"
    });

    expect(kit).toMatchObject({
      generatedAt: "2026-06-12T00:00:00.000Z",
      humanOwned: true,
      noAutoApproval: true,
      noConnectorApproval: true,
      noLiveFetch: true,
      outputDir: "docs/codex/onboarding/review-kit",
      readOnly: true,
      source: {
        id: "pmc-open-access",
        sourceReputation: "high",
        tier: "start-here"
      },
      summary: {
        files: 2,
        inventorySources: 3,
        reviewFields: 14
      }
    });
    expect(kit.files.map((file) => file.kind)).toEqual([
      "inventory-template",
      "source-worksheet"
    ]);
    expect(kit.files[0]?.path).toBe(
      "docs/codex/onboarding/review-kit/fulltext-source-inventory.local.json"
    );
    expect(kit.files[0]?.content).toContain('"approvedForLiveFetch": false');
    expect(kit.files[0]?.content).toContain('"liveFetchSupported": false');
    expect(kit.files[1]?.path).toBe(
      "docs/codex/onboarding/review-kit/fulltext-source-review-pmc-open-access.md"
    );
    expect(kit.files[1]?.content).toContain("No auto approval: true");
    expect(kit.files[1]?.content).toContain("No live fetch: true");
  });

  it("builds an all-source local review kit from the ranked source queue", () => {
    const kit = buildFullTextSourceReviewKit({
      generatedAt: new Date("2026-06-12T00:00:00.000Z"),
      includeAllSources: true,
      outputDir: "docs/codex/onboarding/review-kit"
    });

    expect(kit).toMatchObject({
      generatedAt: "2026-06-12T00:00:00.000Z",
      humanOwned: true,
      noAutoApproval: true,
      noConnectorApproval: true,
      noLiveFetch: true,
      readOnly: true,
      summary: {
        files: 5,
        inventorySources: 3,
        sourceWorksheets: 3
      }
    });
    expect(kit.files.map((file) => file.kind)).toEqual([
      "inventory-template",
      "review-kit-index",
      "source-worksheet",
      "source-worksheet",
      "source-worksheet"
    ]);
    expect(kit.files.map((file) => file.path)).toEqual([
      "docs/codex/onboarding/review-kit/fulltext-source-inventory.local.json",
      "docs/codex/onboarding/review-kit/fulltext-source-review-kit-index.md",
      "docs/codex/onboarding/review-kit/fulltext-source-review-pmc-open-access.md",
      "docs/codex/onboarding/review-kit/fulltext-source-review-operator-local-source-packet.md",
      "docs/codex/onboarding/review-kit/fulltext-source-review-publisher-hosted-full-text.md"
    ]);
    expect(kit.files[0]?.content).toContain('"approvedForLiveFetch": false');
    expect(kit.files[1]?.content).toContain("# Full-Text Source Review Kit Index");
    expect(kit.files[1]?.content).toContain("No connector approval: true");
    expect(kit.files[1]?.content).toContain(
      "It does not approve a source, approve a connector, enable live fetch"
    );
    expect(kit.files[2]?.content).toContain("PubMed Central Open Access subset");
    expect(kit.files[3]?.content).toContain("Operator-provided local source packet");
    expect(kit.files[4]?.content).toContain("Publisher-hosted full text");
  });

  it("summarizes inventory progress against the safe starter", () => {
    const report = buildFullTextSourceInventoryProgressReport({
      generatedAt: new Date("2026-06-12T00:00:00.000Z")
    });
    const summary = summarizeFullTextSourceInventoryProgressReport(report);

    expect(report).toMatchObject({
      generatedAt: "2026-06-12T00:00:00.000Z",
      humanOwned: true,
      noAutoApproval: true,
      noLiveFetch: true,
      readOnly: true,
      summary: {
        changedSources: 0,
        inProgressSources: 0,
        notStartedSources: 3,
        prematureApprovalSources: 0,
        readyForConnectorReviewSources: 0,
        sources: 3
      }
    });
    expect(summary.rows[0]).toMatchObject({
      changedFields: [],
      completedRequiredFields: 1,
      id: "pmc-open-access",
      missingRequiredFields: expect.arrayContaining(["Terms URL"]),
      status: "not-started",
      totalRequiredFields: 14
    });
  });

  it("plans the next full-text source inventory step from the safe starter", () => {
    const plan = buildFullTextSourceInventoryNextActionPlan({
      generatedAt: new Date("2026-06-12T00:00:00.000Z")
    });
    const summary = summarizeFullTextSourceInventoryNextActionPlan(plan);

    expect(plan).toMatchObject({
      generatedAt: "2026-06-12T00:00:00.000Z",
      humanOwned: true,
      inventoryFilePath:
        "docs/codex/onboarding/fulltext-source-inventory.local.json",
      inventoryFileProvided: false,
      noAutoApproval: true,
      noConnectorApproval: true,
      noLiveFetch: true,
      readOnly: true,
      selectedSource: {
        connectorReviewStatus: "blocked",
        id: "pmc-open-access",
        progressStatus: "not-started",
        tier: "start-here"
      },
      status: "create-inventory-template"
    });
    expect(plan.commands.map((command) => command.id)).toEqual([
      "write-all-source-review-kit",
      "write-focused-source-review-kit",
      "check-inventory-progress",
      "refresh-next-action"
    ]);
    expect(plan.commands[0]?.command).toContain("--write-review-kit");
    expect(plan.commands[0]?.command).toContain("--all-sources");
    expect(plan.commands[1]?.command).toContain("--source-id pmc-open-access");
    expect(summary.selectedSource).toMatchObject({
      id: "pmc-open-access",
      missingRequiredFields: expect.arrayContaining(["Terms URL"])
    });
  });

  it("routes an edited inventory to the focused source worksheet", () => {
    const inventory = parseFullTextSourceInventory({
      sources: [
        {
          accessMethod: "api",
          allowedUse: "Open-access full-text capture for reviewed records only.",
          approval: {
            accessMethodReviewed: true,
            robotsOrApiPolicyReviewed: true,
            termsReviewed: true
          },
          authRequired: false,
          cacheTtl: "24h",
          captchaRisk: false,
          dryRunSupported: true,
          id: "pmc-open-access",
          label: "PubMed Central Open Access subset",
          liveFetchSupported: false,
          loginRequired: false,
          policyUrl: "https://example.test/policy",
          privateDataRisk: false,
          rateLimit: "1 request/second",
          rawRetentionPolicy: "",
          reviewedAt: "2026-06-12",
          reviewedBy: "operator",
          sourceKind: "biomedical-literature",
          termsUrl: "https://example.test/terms"
        }
      ]
    });
    const plan = buildFullTextSourceInventoryNextActionPlan({
      inventory,
      inventoryFilePath: "docs/codex/onboarding/local-inventory.json"
    });

    expect(plan).toMatchObject({
      inventoryFileProvided: true,
      selectedSource: {
        id: "pmc-open-access",
        missingRequiredFields: expect.arrayContaining(["Raw retention policy"]),
        progressStatus: "in-progress"
      },
      status: "continue-source-review"
    });
    expect(plan.commands[0]).toMatchObject({
      id: "write-source-worksheet",
      mode: "local-file-write"
    });
    expect(plan.commands[0]?.command).toContain(
      "--inventory-file docs/codex/onboarding/local-inventory.json"
    );
    expect(plan.commands[0]?.command).toContain("--source-id pmc-open-access");
  });

  it("reports changed fields and missing review evidence for an edited inventory", () => {
    const inventory = parseFullTextSourceInventory({
      sources: [
        {
          accessMethod: "api",
          allowedUse: "Open-access full-text capture for reviewed records only.",
          approval: {
            accessMethodReviewed: true,
            robotsOrApiPolicyReviewed: true,
            termsReviewed: true
          },
          authRequired: false,
          cacheTtl: "24h",
          captchaRisk: false,
          dryRunSupported: true,
          id: "pmc-open-access",
          label: "PubMed Central Open Access subset",
          liveFetchSupported: false,
          loginRequired: false,
          policyUrl: "https://example.test/policy",
          privateDataRisk: false,
          rateLimit: "1 request/second",
          rawRetentionPolicy: "",
          reviewedAt: "2026-06-12",
          reviewedBy: "operator",
          sourceKind: "biomedical-literature",
          termsUrl: "https://example.test/terms"
        }
      ]
    });
    const report = buildFullTextSourceInventoryProgressReport({ inventory });

    expect(report.summary).toMatchObject({
      changedSources: 1,
      inProgressSources: 1,
      notStartedSources: 0,
      prematureApprovalSources: 0,
      readyForConnectorReviewSources: 0,
      sources: 1
    });
    expect(report.rows[0]).toMatchObject({
      approvalWarnings: [],
      changedFields: expect.arrayContaining([
        expect.objectContaining({ field: "termsUrl", label: "Terms URL" }),
        expect.objectContaining({
          field: "approval.robotsOrApiPolicyReviewed",
          label: "Robots/API policy reviewed"
        })
      ]),
      missingRequiredFields: expect.arrayContaining(["Raw retention policy"]),
      status: "in-progress"
    });
  });

  it("flags premature approvals before prerequisites are complete", () => {
    const inventory = parseFullTextSourceInventory({
      sources: [
        {
          accessMethod: "api",
          allowedUse: "Open-access full-text capture for reviewed records only.",
          approval: {
            approvedForLiveFetch: true
          },
          authRequired: false,
          cacheTtl: "",
          captchaRisk: false,
          id: "pmc-open-access",
          label: "PubMed Central Open Access subset",
          liveFetchSupported: false,
          loginRequired: false,
          sourceKind: "biomedical-literature"
        }
      ]
    });
    const report = buildFullTextSourceInventoryProgressReport({ inventory });

    expect(report.rows[0]).toMatchObject({
      approvalWarnings: expect.arrayContaining([
        "Live fetch approval is true while liveFetchSupported is false.",
        "One or more approvals are true before terms review is complete."
      ]),
      status: "premature-approval"
    });
  });

  it("marks a fully reviewed source ready for separate connector review", () => {
    const inventory = parseFullTextSourceInventory({
      sources: [
        {
          accessMethod: "api",
          allowedUse: "Open-access full-text capture for reviewed records only.",
          approval: {
            accessMethodReviewed: true,
            approvedForLiveFetch: true,
            approvedForPublicExport: true,
            approvedForStorage: true,
            derivedOnlyExportReviewed: true,
            rawRetentionReviewed: true,
            robotsOrApiPolicyReviewed: true,
            termsReviewed: true
          },
          authRequired: false,
          cacheTtl: "24h",
          captchaRisk: false,
          dryRunSupported: true,
          id: "pmc-open-access",
          label: "PubMed Central Open Access subset",
          liveFetchSupported: true,
          loginRequired: false,
          policyUrl: "https://example.test/policy",
          privateDataRisk: false,
          rateLimit: "1 request/second",
          rawRetentionPolicy: "Local raw text deleted after extraction review.",
          reviewedAt: "2026-06-12",
          reviewedBy: "operator",
          sourceKind: "biomedical-literature",
          termsUrl: "https://example.test/terms"
        }
      ]
    });
    const report = buildFullTextSourceInventoryProgressReport({ inventory });

    expect(report).toMatchObject({
      liveCaptureReady: true,
      summary: {
        readyForConnectorReviewSources: 1
      }
    });
    expect(report.rows[0]).toMatchObject({
      missingRequiredFields: [],
      status: "ready-for-connector-review"
    });
  });

  it("builds a read-only connector review draft without granting connector approval", () => {
    const draft = buildFullTextConnectorReviewDraft({
      generatedAt: new Date("2026-06-12T00:00:00.000Z")
    });
    const summary = summarizeFullTextConnectorReviewDraft(draft);

    expect(draft).toMatchObject({
      generatedAt: "2026-06-12T00:00:00.000Z",
      humanOwned: true,
      noAutoApproval: true,
      noConnectorApproval: true,
      noLiveFetch: true,
      readOnly: true,
      summary: {
        blockedSources: 2,
        holdSources: 1,
        readyForReviewSources: 0,
        sources: 3
      }
    });
    expect(summary.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          connectorKey: "pmc-open-access",
          id: "pmc-open-access",
          reviewStatus: "blocked"
        }),
        expect.objectContaining({
          id: "publisher-hosted-full-text",
          reviewStatus: "hold"
        })
      ])
    );
    expect(draft.rows[0]).toMatchObject({
      policy: {
        derivedOnlyPublicExport: true,
        publicRawTextExport: false
      },
      validationCommands: expect.arrayContaining(["npm run typecheck"])
    });
  });

  it("marks fully reviewed non-held sources ready for connector design review", () => {
    const inventory = parseFullTextSourceInventory({
      sources: [
        {
          accessMethod: "api",
          allowedUse: "Open-access full-text capture for reviewed records only.",
          approval: {
            accessMethodReviewed: true,
            approvedForLiveFetch: true,
            approvedForPublicExport: true,
            approvedForStorage: true,
            derivedOnlyExportReviewed: true,
            rawRetentionReviewed: true,
            robotsOrApiPolicyReviewed: true,
            termsReviewed: true
          },
          authRequired: false,
          cacheTtl: "24h",
          captchaRisk: false,
          dryRunSupported: true,
          id: "pmc-open-access",
          label: "PubMed Central Open Access subset",
          liveFetchSupported: true,
          loginRequired: false,
          policyUrl: "https://example.test/policy",
          privateDataRisk: false,
          rateLimit: "1 request/second",
          rawRetentionPolicy: "Local raw text deleted after extraction review.",
          reviewedAt: "2026-06-12",
          reviewedBy: "operator",
          sourceKind: "biomedical-literature",
          termsUrl: "https://example.test/terms"
        }
      ]
    });
    const draft = buildFullTextConnectorReviewDraft({ inventory });

    expect(draft.summary).toMatchObject({
      blockedSources: 0,
      holdSources: 0,
      readyForReviewSources: 1,
      sources: 1
    });
    expect(draft.rows[0]).toMatchObject({
      blockers: [],
      connectorKey: "pmc-open-access",
      reviewStatus: "ready-for-review"
    });
  });

  it("builds a blocked connector implementation plan without approving connector work", () => {
    const plan = buildFullTextConnectorImplementationPlan({
      generatedAt: new Date("2026-06-12T00:00:00.000Z")
    });
    const summary = summarizeFullTextConnectorImplementationPlan(plan);

    expect(plan).toMatchObject({
      generatedAt: "2026-06-12T00:00:00.000Z",
      humanOwned: true,
      noAutoApproval: true,
      noConnectorApproval: true,
      noLiveFetch: true,
      noNetworkFetch: true,
      readOnly: true,
      summary: {
        blockedSources: 3,
        readyForFixtureDesignSources: 0,
        sources: 3
      }
    });
    expect(plan.rows[0]).toMatchObject({
      blockers: expect.arrayContaining([
        "Source must reach ready-for-review in the connector review draft before fixture design begins."
      ]),
      status: "blocked"
    });
    expect(summary.rows[0]).toMatchObject({
      connectorKey: "pmc-open-access",
      reviewStatus: "blocked",
      status: "blocked"
    });
  });

  it("builds a fixture-first connector implementation plan for reviewed sources", () => {
    const inventory = parseFullTextSourceInventory(
      JSON.parse(
        readFileSync(
          "docs/codex/onboarding/examples/fulltext-source-inventory.reviewed-fixture.example.json",
          "utf8"
        )
      ) as unknown
    );
    const plan = buildFullTextConnectorImplementationPlan({
      generatedAt: new Date("2026-06-12T00:00:00.000Z"),
      inventory
    });
    const markdown = fullTextConnectorImplementationPlanToMarkdown(plan);

    expect(plan).toMatchObject({
      noAutoApproval: true,
      noConnectorApproval: true,
      noLiveFetch: true,
      noNetworkFetch: true,
      summary: {
        blockedSources: 0,
        readyForFixtureDesignSources: 1,
        sources: 1
      }
    });
    expect(plan.rows[0]).toMatchObject({
      blockers: [],
      connectorKey: "synthetic-reviewed-open-access-source",
      guardrails: expect.arrayContaining([
        "Do not add live network fetch in the implementation plan.",
        "Do not expose raw full text through public routes, dashboard state, source packets, or generated reports."
      ]),
      implementationPhases: expect.arrayContaining([
        "Phase 1: add synthetic/local fixture parsing tests only; no network requests."
      ]),
      plannedFiles: expect.arrayContaining([
        "src/lib/full-text/synthetic-reviewed-open-access-source.ts",
        "src/lib/full-text/synthetic-reviewed-open-access-source.test.ts"
      ]),
      status: "ready-for-fixture-design",
      validationCommands: expect.arrayContaining([
        "npm run onboarding:fulltext-sources -- --inventory-file docs/codex/onboarding/fulltext-source-inventory.local.json --connector-plan --summary"
      ])
    });
    expect(markdown).toContain("# Full-Text Connector Implementation Plan");
    expect(markdown).toContain("No connector approval: true");
    expect(markdown).toContain("No network fetch: true");
    expect(markdown).toContain("Public raw text export: false");
  });

  it("builds a blocked connector approval packet without granting approval", () => {
    const packet = buildFullTextConnectorApprovalPacket({
      generatedAt: new Date("2026-06-12T00:00:00.000Z")
    });
    const summary = summarizeFullTextConnectorApprovalPacket(packet);

    expect(packet).toMatchObject({
      approvalGranted: false,
      generatedAt: "2026-06-12T00:00:00.000Z",
      humanOwned: true,
      noAutoApproval: true,
      noConnectorApproval: true,
      noImplementationApproval: true,
      noLiveFetch: true,
      noNetworkFetch: true,
      readOnly: true,
      summary: {
        blockedSources: 2,
        holdSources: 1,
        readyForApprovalSources: 0,
        sources: 3
      }
    });
    expect(packet.rows[0]).toMatchObject({
      approvalGranted: false,
      connectorKey: "pmc-open-access",
      status: "blocked"
    });
    expect(packet.rows[0]?.approvalItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          complete: false,
          id: "connector-review-ready"
        }),
        expect.objectContaining({
          complete: true,
          id: "derived-only-public-export"
        })
      ])
    );
    expect(summary.rows[0]).toMatchObject({
      approvalGranted: false,
      incompleteApprovalItems: expect.arrayContaining([
        "Connector review ready",
        "Fixture-first implementation plan ready"
      ])
    });
  });

  it("marks reviewed fixture plans ready for explicit connector approval", () => {
    const inventory = parseFullTextSourceInventory(
      JSON.parse(
        readFileSync(
          "docs/codex/onboarding/examples/fulltext-source-inventory.reviewed-fixture.example.json",
          "utf8"
        )
      ) as unknown
    );
    const packet = buildFullTextConnectorApprovalPacket({
      generatedAt: new Date("2026-06-12T00:00:00.000Z"),
      inventory
    });
    const summary = summarizeFullTextConnectorApprovalPacket(packet);
    const markdown = fullTextConnectorApprovalPacketToMarkdown(packet);

    expect(packet).toMatchObject({
      approvalGranted: false,
      noConnectorApproval: true,
      noImplementationApproval: true,
      noLiveFetch: true,
      noNetworkFetch: true,
      summary: {
        blockedSources: 0,
        holdSources: 0,
        readyForApprovalSources: 1,
        sources: 1
      }
    });
    expect(packet.rows[0]).toMatchObject({
      approvalGranted: false,
      blockers: [],
      connectorKey: "synthetic-reviewed-open-access-source",
      status: "ready-for-approval"
    });
    expect(packet.rows[0]?.approvalItems.every((item) => item.complete)).toBe(true);
    expect(packet.rows[0]?.operatorDecisionTemplate).toContain(
      "Decision: Approved for fixture-only implementation review"
    );
    expect(summary.rows[0]).toMatchObject({
      approvalGranted: false,
      approvalItems: expect.arrayContaining([
        expect.objectContaining({
          complete: true,
          detail: "Connector review status is ready-for-review.",
          id: "connector-review-ready",
          label: "Connector review ready"
        }),
        expect.objectContaining({
          complete: true,
          id: "read-only-no-live-fetch",
          label: "Read-only/no-live-fetch boundary"
        })
      ]),
      connectorKey: "synthetic-reviewed-open-access-source",
      incompleteApprovalItems: [],
      operatorDecisionTemplate: expect.stringContaining(
        "Decision: Approved for fixture-only implementation review"
      ),
      status: "ready-for-approval",
      validationCommands: expect.arrayContaining([
        "npm run test -- src/lib/full-text-source-readiness.test.ts"
      ])
    });
    expect(markdown).toContain("# Full-Text Connector Approval Packet");
    expect(markdown).toContain("Approval granted: false");
    expect(markdown).toContain("No implementation approval: true");
    expect(markdown).toContain("Ready for explicit approval: 1");
    expect(markdown).toContain("Scope: fixture-only parser and derived-field tests; no live network fetch.");
  });

  it("uses the supplied inventory path in connector approval validation commands", () => {
    const inventoryFilePath =
      "docs/codex/onboarding/examples/fulltext-source-inventory.reviewed-fixture.example.json";
    const inventory = parseFullTextSourceInventory(
      JSON.parse(readFileSync(inventoryFilePath, "utf8")) as unknown
    );
    const packet = buildFullTextConnectorApprovalPacket({
      generatedAt: new Date("2026-06-12T00:00:00.000Z"),
      inventory,
      inventoryFilePath
    });
    const summary = summarizeFullTextConnectorApprovalPacket(packet);
    const validationCommands = summary.rows[0]?.validationCommands ?? [];

    expect(validationCommands).toEqual(
      expect.arrayContaining([
        `npm run onboarding:fulltext-sources -- --inventory-file ${inventoryFilePath} --connector-review --summary`,
        `npm run onboarding:fulltext-sources -- --inventory-file ${inventoryFilePath} --connector-plan --summary`,
        `npm run onboarding:fulltext-sources -- --inventory-file ${inventoryFilePath} --connector-approval-packet --summary`
      ])
    );
    expect(
      validationCommands.some((command) =>
        command.includes("docs/codex/onboarding/fulltext-source-inventory.local.json")
      )
    ).toBe(false);
  });

  it("builds a local connector prep kit without granting connector or implementation approval", () => {
    const inventory = parseFullTextSourceInventory(
      JSON.parse(
        readFileSync(
          "docs/codex/onboarding/examples/fulltext-source-inventory.reviewed-fixture.example.json",
          "utf8"
        )
      ) as unknown
    );
    const kit = buildFullTextConnectorPrepKit({
      generatedAt: new Date("2026-06-12T00:00:00.000Z"),
      inventory,
      outputDir: "docs/codex/onboarding"
    });

    expect(kit).toMatchObject({
      approvalGranted: false,
      noAutoApproval: true,
      noConnectorApproval: true,
      noImplementationApproval: true,
      noLiveFetch: true,
      noNetworkFetch: true,
      readOnly: true,
      summary: {
        files: 5,
        fixtureTemplates: 1,
        readyForApprovalSources: 1,
        readyForFixtureDesignSources: 1,
        readyForReviewSources: 1,
        sources: 1
      }
    });
    expect(kit.files.map((file) => file.kind)).toEqual([
      "connector-prep-index",
      "connector-review",
      "connector-plan",
      "connector-approval-packet",
      "fixture-template"
    ]);
    expect(kit.files[0]).toMatchObject({
      path: "docs/codex/onboarding/fulltext-connector-prep-kit-index.md"
    });
    expect(kit.files[0]?.content).toContain("# Full-Text Connector Prep Kit Index");
    expect(kit.files[0]?.content).toContain("Approval granted: false");
    expect(kit.files[0]?.content).toContain("No implementation approval: true");
    expect(kit.files[0]?.content).toContain("Local fixture starters: 1");
    expect(kit.files[0]?.content).toContain("It does not approve a source");
    expect(kit.files[1]?.content).toContain("# Full-Text Connector Review Draft");
    expect(kit.files[2]?.content).toContain("# Full-Text Connector Implementation Plan");
    expect(kit.files[3]?.content).toContain("# Full-Text Connector Approval Packet");
    expect(kit.files[4]).toMatchObject({
      path:
        "docs/codex/onboarding/fulltext-fixtures/synthetic-reviewed-open-access-source.local.json"
    });
    expect(JSON.parse(kit.files[4]?.content ?? "{}")).toMatchObject({
      sourceId: "synthetic-reviewed-open-access-source",
      textExcerpt:
        "Replace this placeholder with a short reviewed local excerpt needed only for parser-shape testing. Do not paste full article text."
    });
  });

  it("routes fully reviewed source inventory to a separate connector review packet", () => {
    const inventory = parseFullTextSourceInventory({
      sources: [
        {
          accessMethod: "api",
          allowedUse: "Open-access full-text capture for reviewed records only.",
          approval: {
            accessMethodReviewed: true,
            approvedForLiveFetch: true,
            approvedForPublicExport: true,
            approvedForStorage: true,
            derivedOnlyExportReviewed: true,
            rawRetentionReviewed: true,
            robotsOrApiPolicyReviewed: true,
            termsReviewed: true
          },
          authRequired: false,
          cacheTtl: "24h",
          captchaRisk: false,
          dryRunSupported: true,
          id: "pmc-open-access",
          label: "PubMed Central Open Access subset",
          liveFetchSupported: true,
          loginRequired: false,
          policyUrl: "https://example.test/policy",
          privateDataRisk: false,
          rateLimit: "1 request/second",
          rawRetentionPolicy: "Local raw text deleted after extraction review.",
          reviewedAt: "2026-06-12",
          reviewedBy: "operator",
          sourceKind: "biomedical-literature",
          termsUrl: "https://example.test/terms"
        }
      ]
    });
    const plan = buildFullTextSourceInventoryNextActionPlan({
      inventory,
      inventoryFilePath: "docs/codex/onboarding/reviewed-inventory.json"
    });

    expect(plan).toMatchObject({
      selectedSource: {
        connectorReviewStatus: "ready-for-review",
        id: "pmc-open-access",
        missingRequiredFields: [],
        progressStatus: "ready-for-connector-review"
      },
      status: "open-connector-review",
      summary: {
        connectorReadyForReviewSources: 1,
        readyForConnectorReviewSources: 1
      }
    });
    expect(plan.commands.map((command) => command.id)).toEqual([
      "write-connector-prep-kit",
      "check-fixture-progress",
      "validate-fixture-starter",
      "draft-fixture-extraction",
      "connector-review-summary",
      "write-connector-review",
      "connector-plan-summary",
      "write-connector-plan",
      "connector-approval-packet-summary",
      "write-connector-approval-packet",
      "full-text-source-tests"
    ]);
    expect(plan.commands[0]?.command).toContain("--write-connector-prep-kit");
    expect(plan.commands[1]?.command).toBe(
      "npm run onboarding:fulltext-fixture -- --fixture-dir docs/codex/onboarding/fulltext-fixtures --progress --summary"
    );
    expect(plan.commands[2]?.command).toBe(
      "npm run onboarding:fulltext-fixture -- --fixture-file docs/codex/onboarding/fulltext-fixtures/pmc-open-access.local.json --summary"
    );
    expect(plan.commands[3]?.command).toBe(
      "npm run onboarding:fulltext-fixture -- --fixture-file docs/codex/onboarding/fulltext-fixtures/pmc-open-access.local.json --extraction-draft --candidate-key <accepted-candidate-dedupe-key> --study-source-type randomized-controlled-trial --summary"
    );
    expect(plan.commands[5]?.command).toContain("--write-connector-review");
    expect(plan.commands[7]?.command).toContain("--write-connector-plan");
    expect(plan.commands[9]?.command).toContain("--write-connector-approval-packet");
  });

  it("loads the synthetic reviewed fixture as a happy-path local inventory", () => {
    const inventory = parseFullTextSourceInventory(
      JSON.parse(
        readFileSync(
          "docs/codex/onboarding/examples/fulltext-source-inventory.reviewed-fixture.example.json",
          "utf8"
        )
      ) as unknown
    );
    const readiness = buildFullTextSourceReadinessReport({ inventory });
    const progress = buildFullTextSourceInventoryProgressReport({ inventory });
    const connectorDraft = buildFullTextConnectorReviewDraft({ inventory });

    expect(readiness).toMatchObject({
      liveCaptureReady: true,
      summary: {
        blockedSources: 0,
        liveApprovedSources: 1,
        sources: 1
      }
    });
    expect(progress).toMatchObject({
      noLiveFetch: true,
      summary: {
        prematureApprovalSources: 0,
        readyForConnectorReviewSources: 1,
        sources: 1
      }
    });
    expect(connectorDraft).toMatchObject({
      noConnectorApproval: true,
      noLiveFetch: true,
      summary: {
        blockedSources: 0,
        holdSources: 0,
        readyForReviewSources: 1,
        sources: 1
      }
    });
    expect(connectorDraft.rows[0]).toMatchObject({
      connectorKey: "synthetic-reviewed-open-access-source",
      reviewStatus: "ready-for-review"
    });
    expect(connectorDraft.rows[0]?.policy.allowedUse).toContain("Synthetic fixture only");
  });

  it("builds a fixture scenario matrix across source gate states", () => {
    const matrix = buildFullTextSourceFixtureScenarioMatrix({
      generatedAt: new Date("2026-06-12T00:00:00.000Z")
    });
    const summary = summarizeFullTextSourceFixtureScenarioMatrix(matrix);

    expect(matrix).toMatchObject({
      generatedAt: "2026-06-12T00:00:00.000Z",
      humanOwned: true,
      noAutoApproval: true,
      noConnectorApproval: true,
      noLiveFetch: true,
      readOnly: true,
      summary: {
        blockedScenarios: 1,
        connectorReadyForReviewScenarios: 1,
        failedScenarios: 0,
        inProgressScenarios: 1,
        passedScenarios: 4,
        prematureApprovalScenarios: 1,
        readyForConnectorReviewScenarios: 1,
        scenarios: 4
      }
    });
    expect(matrix.rows.map((row) => row.id)).toEqual([
      "blocked-default",
      "in-progress-reviewed-terms",
      "premature-live-approval",
      "ready-synthetic-reviewed"
    ]);
    expect(matrix.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actualConnectorReviewStatus: "blocked",
          actualProgressStatus: "not-started",
          expectedConnectorReviewStatus: "blocked",
          expectedProgressStatus: "not-started",
          id: "blocked-default",
          result: "pass"
        }),
        expect.objectContaining({
          actualConnectorReviewStatus: "blocked",
          actualProgressStatus: "in-progress",
          expectedProgressStatus: "in-progress",
          id: "in-progress-reviewed-terms",
          result: "pass"
        }),
        expect.objectContaining({
          actualProgressStatus: "premature-approval",
          approvalWarnings: expect.arrayContaining([
            "Live fetch approval is true while liveFetchSupported is false."
          ]),
          id: "premature-live-approval",
          result: "pass"
        }),
        expect.objectContaining({
          actualConnectorReviewStatus: "ready-for-review",
          actualProgressStatus: "ready-for-connector-review",
          connectorReadyForReview: true,
          id: "ready-synthetic-reviewed",
          result: "pass"
        })
      ])
    );
    expect(JSON.stringify(summary)).not.toContain('"inventory"');
    expect(summary.rows.every((row) => row.result === "pass")).toBe(true);
  });

  it("renders connector review drafts as markdown with explicit boundaries", () => {
    const draft = buildFullTextConnectorReviewDraft({
      generatedAt: new Date("2026-06-12T00:00:00.000Z")
    });
    const markdown = fullTextConnectorReviewDraftToMarkdown(draft);

    expect(markdown).toContain("# Full-Text Connector Review Draft");
    expect(markdown).toContain("No connector approval: true");
    expect(markdown).toContain("No live fetch: true");
    expect(markdown).toContain("### PubMed Central Open Access subset");
    expect(markdown).toContain("Public raw text export: false");
    expect(markdown).toContain("Keep connector implementation behind an explicit non-public feature gate.");
  });

  it("does not copy live approvals into generated inventory templates", () => {
    const template = buildFullTextSourceInventoryTemplate({
      inventory: [
        {
          accessMethod: "api",
          allowedUse: "Open-access full-text capture for reviewed records only.",
          approval: {
            accessMethodReviewed: true,
            approvedForLiveFetch: true,
            approvedForPublicExport: true,
            approvedForStorage: true,
            derivedOnlyExportReviewed: true,
            rawRetentionReviewed: true,
            robotsOrApiPolicyReviewed: true,
            termsReviewed: true
          },
          authRequired: false,
          cacheTtl: "24h",
          captchaRisk: false,
          dryRunSupported: true,
          id: "reviewed-source",
          label: "Reviewed source",
          liveFetchSupported: true,
          loginRequired: false,
          notes: "Reviewed fixture source.",
          policyUrl: "https://example.test/policy",
          privateDataRisk: false,
          rateLimit: "1 request/second",
          rawRetentionPolicy: "Local raw text deleted after extraction review.",
          reviewedAt: "2026-06-12",
          reviewedBy: "operator",
          sourceKind: "biomedical-literature",
          termsUrl: "https://example.test/terms"
        }
      ]
    });

    expect(template.sources[0]).toMatchObject({
      approval: {
        approvedForLiveFetch: false,
        approvedForPublicExport: false,
        approvedForStorage: false,
        termsReviewed: false
      },
      liveFetchSupported: false,
      reviewedAt: "",
      reviewedBy: ""
    });
  });

  it("rejects malformed inventory entries", () => {
    expect(() =>
      parseFullTextSourceInventory({
        sources: [
          {
            accessMethod: "screen-scrape",
            id: "bad",
            label: "Bad",
            sourceKind: "bad"
          }
        ]
      })
    ).toThrow("Unsupported full-text access method: screen-scrape.");
  });

  it("rejects worksheet requests for unknown source ids", () => {
    expect(() =>
      buildFullTextSourceReviewWorksheet({
        sourceId: "missing-source"
      })
    ).toThrow("Unknown full-text source inventory id: missing-source.");
  });
});
