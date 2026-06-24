import { describe, expect, it } from "vitest";

import {
  buildProductAnalyticsAggregateSchema,
  buildProductAnalyticsKpiFramework,
  summarizeProductAnalyticsKpiFramework,
  validateProductAnalyticsAggregateRows
} from "@/lib/product-analytics-kpis";

describe("product analytics KPI framework", () => {
  it("defines privacy-safe KPIs for every roadmap instrumentation area", () => {
    const framework = buildProductAnalyticsKpiFramework({
      generatedAt: new Date("2026-06-13T00:00:00.000Z")
    });

    expect(framework.generatedAt).toBe("2026-06-13T00:00:00.000Z");
    expect(framework.kpis).toHaveLength(15);
    expect(framework.dashboardBlueprints.map((blueprint) => blueprint.id)).toEqual([
      "public-evidence-usage",
      "operator-workflow-health",
      "ingestion-health",
      "evidence-quality",
      "feedback-and-boundaries"
    ]);
    expect(framework.areaSummaries.map((summary) => summary.area)).toEqual([
      "public_usage",
      "operator_workflow_health",
      "ingestion_health",
      "evidence_quality",
      "user_feedback"
    ]);

    for (const summary of framework.areaSummaries) {
      expect(summary.primaryMetricIds).toHaveLength(1);
      expect(summary.driverMetricIds).toHaveLength(1);
      expect(summary.guardrailMetricIds).toHaveLength(1);
    }
  });

  it("keeps the KPI layer aggregate-only and forbids sensitive fields", () => {
    const framework = buildProductAnalyticsKpiFramework();
    const forbidden = framework.privacyReview.forbiddenFields;

    expect(framework.privacyReview).toMatchObject({
      aggregateOnly: true,
      blockers: [],
      publicRoutesReadOnly: true,
      status: "ready"
    });
    expect(forbidden).toEqual(
      expect.arrayContaining([
        "email",
        "free_text_health_detail",
        "full_ip_address",
        "medical_question_text",
        "raw_label_upload",
        "raw_search_query",
        "session_replay",
        "user_id"
      ])
    );
    expect(
      framework.kpis.flatMap((kpi) =>
        kpi.allowedDimensions.filter((dimension) => forbidden.includes(dimension))
      )
    ).toEqual([]);
    expect(
      framework.kpis.every((kpi) => kpi.forbiddenFields.length === forbidden.length)
    ).toBe(true);
    expect(framework.dashboardBlueprints[0]).toMatchObject({
      id: "public-evidence-usage",
      status: "requires-provider-setup",
      panels: [
        expect.objectContaining({
          sourceStatus: "requires-aggregate-provider"
        })
      ]
    });
    expect(
      framework.dashboardBlueprints.flatMap((blueprint) =>
        blueprint.privacyNotes.filter((note) =>
          forbidden.some((field) => note.toLowerCase().includes(field.replace(/_/g, " ")))
        )
      ).length
    ).toBeGreaterThan(0);
  });

  it("maps every dashboard panel to declared KPI definitions", () => {
    const framework = buildProductAnalyticsKpiFramework();
    const kpiIds = new Set(framework.kpis.map((kpi) => kpi.id));

    for (const blueprint of framework.dashboardBlueprints) {
      expect(blueprint.panels.length).toBeGreaterThan(0);
      expect(blueprint.sourceGaps.every((gap) => gap.trim().length > 0)).toBe(true);

      for (const panel of blueprint.panels) {
        const panelMetricIds = [
          ...panel.primaryMetricIds,
          ...panel.driverMetricIds,
          ...panel.guardrailMetricIds
        ];

        expect(panelMetricIds.length).toBeGreaterThanOrEqual(3);
        expect(panelMetricIds.every((id) => kpiIds.has(id))).toBe(true);
        expect(panel.decision).not.toEqual("");
        expect(panel.requiredSource).not.toEqual("");
      }
    }
  });

  it("keeps ingestion and operator KPIs explicit about no auto-promotion and approved writes", () => {
    const framework = buildProductAnalyticsKpiFramework();
    const autoPromotion = framework.kpis.find(
      (kpi) => kpi.id === "ingestion-auto-promotion-incidents"
    );
    const ungatedWrites = framework.kpis.find(
      (kpi) => kpi.id === "operator-ungated-write-attempts"
    );

    expect(autoPromotion).toMatchObject({
      kind: "guardrail",
      targetDirection: "maintain_zero"
    });
    expect(autoPromotion?.guardrailNotes.join(" ")).toContain("launch safety blocker");
    expect(autoPromotion?.caveats.join(" ")).toContain("remain zero");
    expect(ungatedWrites).toMatchObject({
      kind: "guardrail",
      targetDirection: "maintain_zero"
    });
    expect(ungatedWrites?.guardrailNotes.join(" ")).toContain("actor identity");
    expect(ungatedWrites?.caveats.join(" ")).toContain("fail-closed");
  });

  it("exposes read-only monitoring links plus the provider setup gap", () => {
    const framework = buildProductAnalyticsKpiFramework();
    const blockedWriteTokens = [
      "--accept-candidate",
      "--apply",
      "--extract-candidate-study",
      "--link-candidate-claim",
      "--queue-",
      "--reject-candidate",
      "--run-next"
    ];

    expect(framework.monitoringLinks).toEqual(
      expect.arrayContaining([
        {
          command: "npm run analytics:kpis -- --summary",
          id: "product-analytics-kpi-summary",
          label: "Refresh product analytics KPI summary",
          mode: "read-only"
        },
        {
          command: "npm run analytics:kpis -- --aggregate-schema",
          id: "product-analytics-aggregate-schema",
          label: "Print provider-neutral aggregate schema",
          mode: "read-only"
        },
        {
          command: "npm run analytics:kpis -- --validate-aggregate <aggregate-json-file>",
          id: "product-analytics-aggregate-validation",
          label: "Validate provider-neutral aggregate analytics export",
          mode: "read-only"
        },
        {
          command: "npm run analytics:kpis -- --privacy-review",
          id: "product-analytics-privacy-review",
          label: "Refresh product analytics privacy review",
          mode: "read-only"
        },
        {
          id: "aggregate-analytics-provider",
          label: "Configure privacy-preserving aggregate analytics provider",
          mode: "requires-provider-setup"
        }
      ])
    );
    expect(
      framework.monitoringLinks
        .filter((link) => link.command)
        .every((link) => link.mode === "read-only")
    ).toBe(true);
    expect(
      framework.monitoringLinks.some((link) =>
        blockedWriteTokens.some((token) => link.command?.includes(token))
      )
    ).toBe(false);
  });

  it("builds a compact summary without dumping full metric definitions", () => {
    const framework = buildProductAnalyticsKpiFramework({
      generatedAt: new Date("2026-06-13T00:00:00.000Z")
    });
    const summary = summarizeProductAnalyticsKpiFramework(framework);
    const serialized = JSON.stringify(summary);

    expect(summary).toMatchObject({
      dashboardBlueprints: expect.arrayContaining([
        expect.objectContaining({
          id: "public-evidence-usage",
          panelCount: 1,
          status: "requires-provider-setup"
        }),
        expect.objectContaining({
          id: "evidence-quality",
          panelCount: 1,
          status: "provider-neutral-ready"
        })
      ]),
      generatedAt: "2026-06-13T00:00:00.000Z",
      kpiCount: 15,
      privacyReview: {
        aggregateOnly: true,
        publicRoutesReadOnly: true,
        status: "ready"
      }
    });
    expect(serialized).not.toContain("calculation");
    expect(serialized).not.toContain("qualified_public_evidence_sessions");
    expect(serialized).not.toContain("requiredSource");
  });

  it("validates provider-neutral aggregate rows without requiring provider setup", () => {
    const framework = buildProductAnalyticsKpiFramework({
      generatedAt: new Date("2026-06-13T00:00:00.000Z")
    });
    const validation = validateProductAnalyticsAggregateRows(
      [
        {
          metricId: "public-qualified-evidence-sessions",
          value: 42,
          dimensions: {
            route_group: "dashboard",
            surface_type: "source_packet",
            week: "2026-W24"
          },
          periodStart: "2026-06-08",
          periodEnd: "2026-06-14",
          sourceLabel: "Provider-neutral aggregate export fixture"
        },
        {
          metricId: "operator-review-throughput",
          value: 3,
          dimensions: {
            entity_type: "source_packet",
            review_status: "human_reviewed",
            week: "2026-W24"
          }
        }
      ],
      framework
    );

    expect(validation).toEqual({
      acceptedMetricIds: [
        "operator-review-throughput",
        "public-qualified-evidence-sessions"
      ],
      issueCount: 0,
      issues: [],
      nextAction:
        "Aggregate rows match the provider-neutral KPI schema; source review is still required before connecting real outputs.",
      rowCount: 2,
      status: "ready"
    });
  });

  it("validates Goal 3 aggregate-only rows across every reporting area", () => {
    const goal3MetricIds = [
      "public-qualified-evidence-sessions",
      "operator-review-throughput",
      "scheduled-ingestion-success-rate",
      "human-reviewed-source-packet-coverage",
      "feedback-actionable-triage-rate",
      "operator-review-queue-age",
      "score-snapshot-freshness"
    ] as const;

    const validation = validateProductAnalyticsAggregateRows([
      {
        metricId: "public-qualified-evidence-sessions",
        value: 42,
        dimensions: {
          route_group: "dashboard",
          surface_type: "source_packet",
          week: "2026-W24"
        },
        periodStart: "2026-06-08",
        periodEnd: "2026-06-14",
        sourceLabel: "Goal 3 aggregate coverage fixture"
      },
      {
        metricId: "operator-review-throughput",
        value: 3,
        dimensions: {
          entity_type: "source_packet",
          review_status: "human_reviewed",
          week: "2026-W24"
        }
      },
      {
        metricId: "scheduled-ingestion-success-rate",
        value: 0.96,
        dimensions: {
          job_status: "completed",
          source: "pubmed",
          week: "2026-W24"
        }
      },
      {
        metricId: "human-reviewed-source-packet-coverage",
        value: 0.88,
        dimensions: {
          final_label: "supported",
          outcome_area: "longevity",
          week: "2026-W24"
        }
      },
      {
        metricId: "feedback-actionable-triage-rate",
        value: 0.75,
        dimensions: {
          feedback_type: "source_correction",
          triage_state: "accepted",
          week: "2026-W24"
        }
      },
      {
        metricId: "operator-review-queue-age",
        value: 5,
        dimensions: {
          review_status: "accepted",
          work_item_type: "source_candidate",
          week: "2026-W24"
        }
      },
      {
        metricId: "score-snapshot-freshness",
        value: 14,
        dimensions: {
          final_label: "supported",
          outcome_area: "longevity",
          week: "2026-W24"
        }
      }
    ]);

    expect(validation.status).toBe("ready");
    expect(validation.issueCount).toBe(0);
    expect(validation.issues).toEqual([]);
    expect(validation.rowCount).toBe(7);
    expect(validation.acceptedMetricIds).toEqual(
      expect.arrayContaining([...goal3MetricIds])
    );
    expect(validation.acceptedMetricIds).toHaveLength(goal3MetricIds.length);
  });

  it("exports a provider-neutral aggregate schema without provider setup", () => {
    const schema = buildProductAnalyticsAggregateSchema(
      buildProductAnalyticsKpiFramework({
        generatedAt: new Date("2026-06-13T00:00:00.000Z")
      })
    );

    expect(schema).toMatchObject({
      aggregateOnly: true,
      allowedTopLevelFields: [
        "dimensions",
        "metricId",
        "periodEnd",
        "periodStart",
        "sourceLabel",
        "value"
      ],
      forbiddenFields: expect.arrayContaining([
        "email",
        "free_text_health_detail",
        "full_ip_address",
        "medical_question_text",
        "raw_label_upload",
        "raw_search_query",
        "session_replay",
        "user_id"
      ]),
      publicRoutesReadOnly: true,
      readOnly: true,
      requiredTopLevelFields: ["metricId", "value"],
      sourceReviewRequired: true
    });
    expect(schema.metrics).toHaveLength(15);
    expect(schema.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          allowedDimensions: ["route_group", "intervention_id", "surface_type", "week"],
          metricId: "public-qualified-evidence-sessions",
          sourceStatus: "requires-aggregate-provider"
        }),
        expect.objectContaining({
          allowedDimensions: ["entity_type", "review_status", "operator_role", "week"],
          metricId: "operator-review-throughput",
          sourceStatus: "available-after-reviewed-export"
        })
      ])
    );
    expect(schema.nextAction).toContain("privacy-preserving aggregate provider choice");
  });

  it("blocks aggregate rows with forbidden fields or undeclared dimensions", () => {
    const validation = validateProductAnalyticsAggregateRows([
      {
        metricId: "public-qualified-evidence-sessions",
        value: 5,
        dimensions: {
          raw_label_upload: "private label text",
          route_group: "dashboard"
        }
      },
      {
        metricId: "feedback-actionable-triage-rate",
        value: 0.8,
        dimensions: {
          feedback_type: "source_correction",
          medical_question_text: "private medical context"
        },
        user_id: "do-not-collect"
      },
      {
        metricId: "not-a-declared-kpi",
        value: "7",
        dimensions: {
          week: "2026-W24"
        }
      },
      {
        metricId: "score-snapshot-freshness",
        value: 14,
        dimensions: {
          route_group: "detail"
        }
      }
    ]);

    expect(validation).toMatchObject({
      acceptedMetricIds: [
        "feedback-actionable-triage-rate",
        "public-qualified-evidence-sessions",
        "score-snapshot-freshness"
      ],
      issueCount: 6,
      rowCount: 4,
      status: "blocked"
    });
    expect(validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "dimensions.raw_label_upload",
          message: "Aggregate row includes a forbidden analytics dimension.",
          metricId: "public-qualified-evidence-sessions",
          rowIndex: 0
        }),
        expect.objectContaining({
          field: "user_id",
          message: "Aggregate row includes a forbidden top-level analytics field.",
          metricId: "feedback-actionable-triage-rate",
          rowIndex: 1
        }),
        expect.objectContaining({
          field: "dimensions.medical_question_text",
          message: "Aggregate row includes a forbidden analytics dimension.",
          metricId: "feedback-actionable-triage-rate",
          rowIndex: 1
        }),
        expect.objectContaining({
          field: "metricId",
          message: "Aggregate row references an undeclared KPI metric.",
          metricId: "not-a-declared-kpi",
          rowIndex: 2
        }),
        expect.objectContaining({
          field: "value",
          message: "Aggregate row value must be a finite number.",
          metricId: "not-a-declared-kpi",
          rowIndex: 2
        }),
        expect.objectContaining({
          field: "dimensions.route_group",
          message: "Aggregate row includes a dimension not declared for this KPI.",
          metricId: "score-snapshot-freshness",
          rowIndex: 3
        })
      ])
    );
  });

  it("blocks provider exports with undeclared payload fields or malformed periods", () => {
    const validation = validateProductAnalyticsAggregateRows([
      {
        metricId: "public-detail-depth-rate",
        value: 0.42,
        dimensions: {
          route_group: "dashboard",
          surface_type: ["source_packet"]
        },
        periodStart: "2026-06-15",
        periodEnd: "2026-06-14",
        raw_provider_payload: {
          raw_label_upload: "do not pass through nested provider payloads"
        }
      },
      {
        metricId: "public-qualified-evidence-sessions",
        value: 12,
        dimensions: [] as unknown as Record<string, unknown>,
        periodStart: "2026-13-01",
        periodEnd: "2026-06-14"
      }
    ]);

    expect(validation).toMatchObject({
      acceptedMetricIds: [
        "public-detail-depth-rate",
        "public-qualified-evidence-sessions"
      ],
      issueCount: 5,
      nextAction:
        "Remove forbidden fields, undeclared payload fields or dimensions, malformed values, and invalid periods before connecting analytics outputs.",
      rowCount: 2,
      status: "blocked"
    });
    expect(validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "raw_provider_payload",
          message: "Aggregate row includes an undeclared top-level analytics field.",
          metricId: "public-detail-depth-rate",
          rowIndex: 0
        }),
        expect.objectContaining({
          field: "dimensions.surface_type",
          message:
            "Aggregate dimension values must be strings, finite numbers, booleans, or null.",
          metricId: "public-detail-depth-rate",
          rowIndex: 0
        }),
        expect.objectContaining({
          field: "periodStart",
          message: "Aggregate row periodStart must not be after periodEnd.",
          metricId: "public-detail-depth-rate",
          rowIndex: 0
        }),
        expect.objectContaining({
          field: "dimensions",
          message: "Aggregate row dimensions must be an object of scalar values.",
          metricId: "public-qualified-evidence-sessions",
          rowIndex: 1
        }),
        expect.objectContaining({
          field: "periodStart",
          message: "Aggregate row period fields must be valid YYYY-MM-DD dates.",
          metricId: "public-qualified-evidence-sessions",
          rowIndex: 1
        })
      ])
    );
  });
});
