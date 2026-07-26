import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  buildCodexReviewPacket,
  buildSourcePacketGapRows,
  EvidenceDashboard,
  runLocalUpdatePipeline
} from "@/components/evidence-dashboard";
import { buildScoreReadinessRows } from "@/lib/score-readiness";
import {
  australiaRegulatoryStatuses,
  claims,
  interventions,
  productSignals,
  references,
  safetyAlerts,
  studies,
  trialWatchItems
} from "@/lib/seed-data";
import { summarizeClaimSourcePackets } from "@/lib/source-packet";
import type { EvidenceDashboardData } from "@/lib/types";

function emptyDashboardData(): EvidenceDashboardData {
  return {
    australiaRegulatoryStatuses: [],
    claims: [],
    dataSource: "database",
    interventions: [],
    productSignals: [],
    references: [],
    safetyAlerts: [],
    studies: [],
    trialWatchItems: []
  };
}

function seedDashboardData(): EvidenceDashboardData {
  return {
    australiaRegulatoryStatuses,
    claims,
    dataSource: "seed",
    interventions,
    productSignals,
    references,
    safetyAlerts,
    studies,
    trialWatchItems
  };
}

describe("EvidenceDashboard", () => {
  it("renders cautious empty states when no local claims are available", () => {
    const html = renderToStaticMarkup(<EvidenceDashboard data={emptyDashboardData()} />);

    expect(html).toContain("No evidence-browser cells match the current filters and map mode.");
    expect(html).toContain("Evidence Notes");
    expect(html).toContain("Catalog Trust");
  });

  it("renders database catalog banner when dashboard data comes from local DB", () => {
    const data: EvidenceDashboardData = {
      ...seedDashboardData(),
      dataSource: "database"
    };
    const html = renderToStaticMarkup(<EvidenceDashboard data={data} />);

    expect(html).toContain("Local database catalog");
    expect(html).toContain("local catalog (6 interventions, 9 scoped claims)");
    expect(html).toContain("Evidence briefs are the main product");
    expect(html).toContain("Database-backed");
  });

  it("renders the seed-backed dashboard with evidence map and section tabs", () => {
    const data = seedDashboardData();
    const html = renderToStaticMarkup(<EvidenceDashboard data={data} />);

    expect(html).toContain("Apex Lifespan");
    expect(html).toContain("9 scoped claims");
    expect(html).toContain("Evidence Guide");
    expect(html).toContain("Evidence Notes");
    expect(html).toContain("Catalog Trust");
    expect(html).toContain("Start here");
    expect(html).toContain("Plain-language evidence guide");
    expect(html).toContain("full-local-catalog readout");
    expect(html).toContain("what the evidence appears to say");
    expect(html).toContain("not clinical recommendations");
    expect(html).toContain("Claim cells scanned");
    expect(html).toContain("Guide entries");
    expect(html).toContain("Scored entries");
    expect(html).toContain("Source-work entries");
    expect(html).toContain("Quick answer for friends");
    expect(html).toContain("Most worth attention");
    expect(html).toContain("Context-dependent");
    expect(html).toContain("Caution first");
    expect(html).toContain("Longevity reality check");
    expect(html).toContain("No broad lifespan shortcut");
    expect(html).toContain("Best practical bets now");
    expect(html).toContain("Worth considering if relevant");
    expect(html).toContain("Niche / performance-focused");
    expect(html).toContain("Popular but not well-backed");
    expect(html).toContain("Source work needed");
    expect(html).toContain("Emerging but not settled");
    expect(html).toContain("Safety / clinician-only / regulatory watchlist");
    expect(html).toContain("Longevity lens");
    expect(html).toContain("Direct lifespan evidence");
    expect(html).toContain("Healthspan evidence");
    expect(html).toContain("Biomarker evidence");
    expect(html).toContain("Mechanistic / animal evidence");
    expect(html).toContain("Speculative hype");
    expect(html).toContain("Emerging evidence radar");
    expect(html).toContain("Clinical trials to watch");
    expect(html).toContain("Ranking-impacting source gaps");
    expect(html).toContain("kept out of");
    expect(html).toContain("Newer studies or source leads");
    expect(html).toContain("Evidence momentum");
    expect(html).toContain("Direct lifespan evidence is separated from healthspan");
    expect(html).toContain("Source lead");
    expect(html).toContain("Not proven");
    expect(html).toContain("Safety context");
    expect(html).toContain("Prototype / seed dataset");
    expect(html).toContain("seed dataset and live source-search previews support plain-language evidence briefs");
    expect(html).toContain("scores are audit aids, not");
    expect(html).toContain("medical advice");
    expect(html).toContain("Translate evidence");
    expect(html).toContain("Ranked evidence by outcome");
    expect(html.indexOf("Ranked evidence by outcome")).toBeLessThan(
      html.indexOf("Plain-language evidence guide")
    );
    expect(html).toContain("Top-ranked supplements appear first within each outcome");
    expect(html).toContain("Ranked evidence signals by outcome");
    expect(html).toContain("Top 3");
    expect(html).toContain("Top 5");
    expect(html).toContain("Top 10");
    expect(html).toContain("Show source/score work");
    expect(html).toContain("Top scored first");
    expect(html).toContain("Confidence tie-breaker");
    expect(html).toContain("Work hidden by default");
    expect(html).toContain("Coverage matrix and source-work gaps");
    expect(html).toContain("old coverage view for spotting unassessed cells");
    expect(html).toContain("renders only when opened");
    expect(html).toContain("not a supplement recommendation");
    expect(html).toContain("Creatine monohydrate");
    expect(html).toContain("About Muscle/strength column");
    expect(html).toContain("Strength, power, lean-mass, or functional performance support.");
    expect(html).toContain("1. Creatine monohydrate, Muscle/strength: 8.4 Strong, Confidence 4/4 (High)");
    expect(html).toContain("Confidence 4/4 (High)");
    expect(html).toContain("Extraction complete");
    expect(html).not.toContain("Evidence browser. Rows are interventions and columns are outcomes.");
    expect(html).not.toContain("Sort supplements by Muscle/strength, highest score first");
    expect(html).not.toContain(
      "Click an outcome column to sort rows high to low, then low to high, then alphabetical again."
    );
    expect(html).not.toContain("Creatine monohydrate, Muscle/strength: Draft composite 8.4 out of 10");
    expect(html).toContain("AI Draft Classification Core Evidence-Based");
    expect(html).not.toContain(
      "BPC-157, Muscle/strength: not yet assessed; this does not mean no evidence exists."
    );
    expect(html).not.toContain("—</strong> = not yet assessed");
    expect(html).not.toContain("N/A</strong> = not applicable");
    expect(html).not.toContain("No evidence found</strong> = searched and no credible evidence found");
    expect(html).not.toContain("Unassessed cells do not imply absence of evidence.");
    expect(html).toContain('href="/interventions/creatine-monohydrate?tab=claims#claim-creatine-strength"');
    expect(html).toContain('id="evidence-map-label"');
    expect(html).toContain('id="evidence-map-outcome"');
    expect(html).toContain("All labels");
    expect(html).toContain("All outcomes");
    expect(html).not.toContain("Local catalog trust");
    expect(html).not.toContain("Source packet gap worklist");
    expect(html).not.toContain("Selected claim");
    expect(html).toContain("Showing 6 interventions · 9 scoped claims");
    expect(html).not.toContain("Dashboard detail sections");
    expect(html).not.toContain("Active card source packet");
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/methodology"');
    expect(html).toContain('href="/changelog"');
    expect(html).toContain('href="/feedback"');
    expect(html).toContain('href="/terms"');
    expect(html).not.toContain("Seed example");
  });

  it("keeps every structured claim in the practical guide instead of capping bucket membership", () => {
    const data = seedDashboardData();
    const targetClaim = data.claims.find((claim) => claim.id === "creatine-strength");

    expect(targetClaim).toBeDefined();

    const exhaustiveClaims = Array.from({ length: 8 }, (_, index) => ({
      ...targetClaim!,
      id: `creatine-strength-guide-${index + 1}`,
      claimText: `${targetClaim!.claimText} Guide duplicate ${index + 1}.`
    }));

    const html = renderToStaticMarkup(
      <EvidenceDashboard
        data={{
          ...data,
          claims: exhaustiveClaims
        }}
      />
    );

    expect(html).toContain("Claim cells scanned");
    expect(html).toContain("Guide entries");
    expect(html).toContain("Show all 8 (2 more)");
  });

  it("shows the plain-language takeaway on ranked map tiles so adverse signals are not framed as simple benefits", () => {
    const data = seedDashboardData();
    const reference = data.references[0];
    const caffeineClaim = {
      ...data.claims[0],
      id: "caffeine-sleep",
      interventionId: "caffeine",
      outcome: "Sleep" as const,
      claimText: "Sleep quality or sleep-continuity support.",
      confidenceLevel: "Very low" as const,
      finalLabel: "Useful for Specific Use Case" as const,
      keyReferenceIds: [reference.id],
      summary:
        "The clearest sleep-related conclusion is adverse: caffeine can impair sleep timing, continuity, or quality depending on timing and individual sensitivity.",
      uncertainty:
        "Sleep effects depend on dose timing, metabolism, tolerance, baseline sleep, and co-use with other stimulants; the dashboard should not frame this as a sleep benefit.",
      scores: {
        evidenceDirectness: 9,
        evidenceRigor: 10,
        effectSize: 5,
        safety: 7,
        regulatoryRisk: 4,
        productQuality: 5,
        hypePenalty: 3,
        measurability: 5
      }
    };
    const html = renderToStaticMarkup(
      <EvidenceDashboard
        data={{
          ...data,
          claims: [...data.claims, caffeineClaim],
          interventions: [
            ...data.interventions,
            {
              ...data.interventions[0],
              evidenceSummary:
                "Best interpreted as an acute performance and alertness aid with sleep tradeoffs.",
              id: "caffeine",
              name: "Caffeine",
              slug: "caffeine"
            }
          ],
          studies: [
            ...data.studies,
            {
              ...data.studies[0],
              id: "study-caffeine-sleep",
              intervention: "Caffeine",
              outcomes: ["Sleep timing", "Sleep continuity", "Sleep quality"],
              referenceId: reference.id,
              title: "The effect of caffeine on subsequent sleep"
            }
          ]
        }}
      />
    );

    expect(html).toContain("Caffeine");
    expect(html).toContain("Confidence 1/4 (Very low)");
    expect(html).toContain("Caution/adverse signal");
    expect(html).toContain(
      "Takeaway: The clearest sleep-related conclusion is adverse: caffeine can impair sleep timing, continuity, or quality depending on timing and individual sensitivity."
    );
  });

  it("keeps source-packet extraction separate from human review status", () => {
    const data = seedDashboardData();
    const sourcePacketSummary = sourcePacketSummaryFor(data);
    const html = renderToStaticMarkup(<EvidenceDashboard data={data} />);

    expect(html).toContain("Pending human review");
    expect(sourcePacketSummary.completeClaims).toBeGreaterThan(0);
  });

  it("marks scored-looking map cells as source work when linked extraction is incomplete", () => {
    const data = seedDashboardData();
    const targetClaim = data.claims.find((claim) => claim.keyReferenceIds.length > 0);

    expect(targetClaim).toBeDefined();

    const html = renderToStaticMarkup(
      <EvidenceDashboard
        data={{
          ...data,
          studies: data.studies.filter(
            (study) => !targetClaim?.keyReferenceIds.includes(study.referenceId)
          )
        }}
      />
    );

    expect(html).toContain("Source work");
    expect(html).toContain("Show source/score work");
    expect(html).toContain("No scored supplements yet. Enable source/score work to audit unfinished rows.");
    expect(html).toContain("Source blockers:");
    expect(html).toContain("Source work:</span> 2 blocked (extraction pending 2)");
  });

  it("ranks source-packet gaps by actionable extraction work", () => {
    const data = seedDashboardData();
    const targetClaim = data.claims.find((claim) => claim.keyReferenceIds.length > 0);

    expect(targetClaim).toBeDefined();

    const gapRows = buildSourcePacketGapRows({
      ...data,
      studies: data.studies.filter(
        (study) => !targetClaim?.keyReferenceIds.includes(study.referenceId)
      )
    });
    const targetRow = gapRows.find((row) => row.claim.id === targetClaim?.id);

    expect(targetRow).toBeDefined();
    expect(targetRow?.packet.completeness.status).toBe("extraction_pending");
    expect(targetRow?.reasons.join(" ")).toContain("linked ref(s) need extraction");
    expect(targetRow?.reasons.join(" ")).toContain("stored composite hidden until source-blocked");
    expect(targetRow?.intervention?.slug).toBeTruthy();
  });

  it("separates score-ready claims from starter-looking public scores", () => {
    const data = seedDashboardData();
    const sourceBackedClaim = data.claims.find((claim) => claim.keyReferenceIds.length > 0);

    expect(sourceBackedClaim).toBeDefined();

    const scoreReadyClaim = {
      ...sourceBackedClaim!,
      id: "score-ready-test",
      evidenceGrade: "Insufficient until source packets are reviewed."
    };
    const starterScoreClaim = {
      ...sourceBackedClaim!,
      id: "starter-score-test",
      evidenceGrade: "Starter score review fixture",
      finalLabel: "Insufficient Evidence" as const,
      scores: {
        evidenceDirectness: 3,
        evidenceRigor: 3,
        effectSize: 3,
        safety: 4,
        regulatoryRisk: 7,
        productQuality: 4,
        hypePenalty: 7,
        measurability: 3
      }
    };
    const rows = buildScoreReadinessRows({
      ...data,
      claims: [...data.claims, scoreReadyClaim, starterScoreClaim],
      claimScoreSnapshots: []
    });
    const scoreReadyRow = rows.find((row) => row.claim.id === scoreReadyClaim.id);
    const starterScoreRow = rows.find((row) => row.claim.id === starterScoreClaim.id);

    expect(scoreReadyRow?.state).toBe("ready_to_score");
    expect(scoreReadyRow?.reasons).toContain("source packet complete");
    expect(starterScoreRow?.state).toBe("default_score_review");
    expect(starterScoreRow?.currentScore).toBe(3.1);
    expect(starterScoreRow?.reasons.join(" ")).toContain("starter-score pattern");

    const html = renderToStaticMarkup(
      <EvidenceDashboard
        data={{
          ...data,
          claims: [scoreReadyClaim],
          claimScoreSnapshots: []
        }}
      />
    );

    expect(html).toContain("Ready to score");
    expect(html).toContain("No scored supplements yet. Enable source/score work to audit unfinished rows.");
    expect(html).toContain("Score work:</span> 1 ready, 0 score review, 0 audit");
    expect(html).not.toContain("Draft composite 8.4");

    const starterHtml = renderToStaticMarkup(
      <EvidenceDashboard
        data={{
          ...data,
          claims: [starterScoreClaim],
          claimScoreSnapshots: []
        }}
      />
    );

    expect(starterHtml).toContain("Score work");
    expect(starterHtml).toContain("No scored supplements yet. Enable source/score work to audit unfinished rows.");
    expect(starterHtml).toContain("1 score review");
    expect(starterHtml).not.toContain("Draft composite 3.1 out of 10");
  });

  it("renders sanitized seed fallback reasons in the public header", () => {
    const html = renderToStaticMarkup(
      <EvidenceDashboard
        data={{
          ...seedDashboardData(),
          fallbackReason: "Database query failed, using seed data."
        }}
      />
    );

    expect(html).toContain("Seed fallback");
    expect(html).toContain("Database query failed, using seed data.");
  });

  it("renders a Codex packet approval entry point without running operator actions", () => {
    const html = renderToStaticMarkup(<EvidenceDashboard data={seedDashboardData()} />);

    expect(html).toContain("Operator mode");
    expect(html).toContain("local only");
    expect(html).toContain("token stays in tab");
    expect(html).not.toContain("Ask Codex");
    expect(html).not.toContain("Approve and copy");
  });

  it("runs the local UPDATE pipeline through refresh with recommended automation settings", async () => {
    type LocalUpdatePipelineTestOperations = NonNullable<
      Parameters<typeof runLocalUpdatePipeline>[0]["operations"]
    >;

    const calls: string[] = [];
    const stageStatuses = new Map<string, string>();
    const logMessages: string[] = [];
    let acceptedProcessingRuns = 0;
    const benefitAutomationInputs: Array<{
      apply: boolean;
      rejectThreshold: number;
      scope: string;
      strategy: string;
      threshold: number;
    }> = [];
    const queuedStatus = localPipelineStatus({ queued: 1, totalCandidates: 4 });
    const emptyStatus = localPipelineStatus({ queued: 0, totalCandidates: 6 });

    const operations: LocalUpdatePipelineTestOperations = {
      fetchAcceptedCandidateProcessingStatus: async () => {
        calls.push("fetch-accepted-status");
        return localPipelineAcceptedStatus({ processed: 2 });
      },
      fetchBenefitDiscoveryQueue: async () => {
        calls.push("fetch-benefit-queue");
        return {
          clusters: [],
          counts: {
            activeCandidates: 0,
            activeClusters: 0,
            decidedClusters: 3,
            mismatchCandidates: 0,
            parkedClusters: 1
          },
          updatedAt: "2026-01-01T00:00:00.000Z"
        };
      },
      fetchIngestionStatus: async () => {
        calls.push("fetch-ingestion-status");
        return emptyStatus;
      },
      postAcceptedCandidateProcessingRun: async () => {
        calls.push("process-accepted");
        acceptedProcessingRuns += 1;

        if (acceptedProcessingRuns > 1) {
          return {
            errors: [],
            hasMore: false,
            limit: 50,
            processed: 0,
            results: [],
            status: localPipelineAcceptedStatus({ processed: 2 })
          };
        }

        return {
          errors: [],
          hasMore: false,
          limit: 50,
          processed: 2,
          results: [
            localPipelineAcceptedResult({ dedupeKey: "accepted-1", linkedClaim: true }),
            localPipelineAcceptedResult({ dedupeKey: "accepted-2", linkedClaim: false })
          ],
          status: localPipelineAcceptedStatus({ processed: 2 })
        };
      },
      postBenefitDiscoveryAutomation: async (input) => {
        calls.push(`benefit-${input.strategy}`);
        benefitAutomationInputs.push(input);
        return localPipelineBenefitAutomationResponse(input.strategy, {
          rejectThreshold: input.rejectThreshold,
          threshold: input.threshold
        });
      },
      postCandidateReviewAutomation: async () => {
        calls.push("candidate-auto");
        return {
          action: "auto-triage-maybe-useful",
          applied: true,
          counts: {
            accepted: 1,
            appliedActions: 1,
            errors: 0,
            held: 1,
            rejected: 0,
            scanned: 2
          },
          decisions: [],
          filters: {
            bucket: "maybe-useful",
            limit: 25,
            source: "ALL",
            studyFilter: "all"
          },
          message: "Maybe useful processed.",
          status: "completed",
          strategy: "query-backed",
          updatedAt: "2026-01-01T00:00:00.000Z"
        };
      },
      postCandidateReviewBulkDecision: async () => {
        calls.push("candidate-bulk");
        return {
          accepted: 2,
          errors: [],
          rejected: 0,
          scanned: 2,
          status: "completed"
        };
      },
      postIdentityResolutionAutomation: async () => {
        calls.push("identity");
        return {
          action: "auto-resolve",
          applied: true,
          counts: {
            appliedActions: 1,
            confirmTarget: 1,
            errors: 0,
            hold: 0,
            reassignIntervention: 0,
            rejectWrongSupplement: 0,
            scannedCandidates: 1
          },
          decisions: [],
          limit: 2000,
          message: "Identity resolved.",
          scope: "all-eligible",
          strategy: "source-led",
          updatedAt: "2026-01-01T00:00:00.000Z"
        };
      },
      postIngestionRun: async (_limit, minDelayMs) => {
        calls.push(`ingest-run-${minDelayMs}`);
        return {
          hasMoreQueued: false,
          limit: 1,
          processed: 1,
          results: [
            {
              jobId: "job-1",
              query: "ashwagandha",
              recordsChanged: 2,
              recordsFound: 3,
              region: "AU",
              source: "PUBMED",
              status: "SUCCEEDED"
            }
          ],
          safety: {
            minDelayMs
          },
          status: emptyStatus
        };
      },
      postIngestionStart: async () => {
        calls.push("ingestion-start");
        return localPipelineStartResponse(queuedStatus, { newJobs: 1 });
      },
      postIngestionSynonyms: async () => {
        calls.push("ingestion-synonyms");
        return localPipelineStartResponse(emptyStatus, {
          existingJobs: 0,
          newJobs: 0,
          phase: "synonym",
          searchTermCount: 0
        });
      },
      postClaimExpansion: async () => {
        calls.push("claim-expansion");
        return localPipelineClaimExpansionResponse();
      },
      postScoreFinalization: async () => {
        calls.push("score-finalization");
        return localPipelineScoreFinalizationResponse();
      },
      postSourceWorkRepair: async () => {
        calls.push("source-work-repair");
        return localPipelineSourceWorkRepairResponse();
      }
    };

    const result = await runLocalUpdatePipeline({
      appendLog: (entry) => {
        logMessages.push(entry.message);
      },
      operations,
      setStageStatus: (id, status) => {
        stageStatuses.set(id, status);
      },
      settings: {
        leadThreshold: 70,
        rejectThreshold: 40,
        runDelayMs: 5000,
        sessionJobLimit: 100
      },
      sleepFor: async () => undefined
    });

    expect(result.status).toBe("completed");
    expect(calls).toEqual([
      "ingestion-start",
      "process-accepted",
      "ingest-run-5000",
      "ingestion-synonyms",
      "candidate-bulk",
      "candidate-auto",
      "process-accepted",
      "identity",
      "benefit-build-leads",
      "benefit-park-backlog",
      "claim-expansion",
      "source-work-repair",
      "score-finalization",
      "fetch-ingestion-status",
      "fetch-accepted-status",
      "fetch-benefit-queue"
    ]);
    expect(benefitAutomationInputs).toEqual([
      {
        apply: true,
        rejectThreshold: 40,
        scope: "all-eligible",
        strategy: "build-leads",
        threshold: 70
      },
      {
        apply: true,
        rejectThreshold: 40,
        scope: "all-eligible",
        strategy: "park-backlog",
        threshold: 70
      }
    ]);
    expect(stageStatuses.get("refresh")).toBe("done");
    expect(logMessages).toContain("Derived dashboard refresh finished");
  });

  it("surfaces local UPDATE pipeline error counts and reasons for build leads", async () => {
    type LocalUpdatePipelineTestOperations = NonNullable<
      Parameters<typeof runLocalUpdatePipeline>[0]["operations"]
    >;

    const stageStatuses = new Map<string, string>();
    const stageDetails = new Map<string, string | undefined>();
    const logEntries: Array<{ detail?: string; level: string; message: string }> = [];
    const emptyStatus = localPipelineStatus({ queued: 0, totalCandidates: 1 });

    const operations: LocalUpdatePipelineTestOperations = {
      fetchAcceptedCandidateProcessingStatus: async () => localPipelineAcceptedStatus({ processed: 0 }),
      fetchBenefitDiscoveryQueue: async () => ({
        clusters: [],
        counts: {
          activeCandidates: 0,
          activeClusters: 1,
          decidedClusters: 0,
          mismatchCandidates: 0,
          parkedClusters: 0
        },
        updatedAt: "2026-01-01T00:00:00.000Z"
      }),
      fetchIngestionStatus: async () => emptyStatus,
      postAcceptedCandidateProcessingRun: async () => ({
        errors: [],
        hasMore: false,
        limit: 25,
        processed: 0,
        results: [],
        status: localPipelineAcceptedStatus({ processed: 0 })
      }),
      postBenefitDiscoveryAutomation: async (input) =>
        localPipelineBenefitAutomationResponse(input.strategy, {
          error:
            input.strategy === "build-leads"
              ? "Claim draft failed because accepted reference ref-1 was missing."
              : undefined,
          rejectThreshold: input.rejectThreshold,
          threshold: input.threshold
        }),
      postCandidateReviewAutomation: async () => ({
        action: "auto-triage-maybe-useful",
        applied: true,
        counts: {
          accepted: 0,
          appliedActions: 0,
          errors: 0,
          held: 0,
          rejected: 0,
          scanned: 0
        },
        decisions: [],
        filters: {
          bucket: "maybe-useful",
          limit: 25,
          source: "ALL",
          studyFilter: "all"
        },
        message: "Maybe useful processed.",
        status: "completed",
        strategy: "query-backed",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }),
      postCandidateReviewBulkDecision: async () => ({
        accepted: 0,
        errors: [],
        rejected: 0,
        scanned: 0,
        status: "completed"
      }),
      postIdentityResolutionAutomation: async () => ({
        action: "auto-resolve",
        applied: true,
        counts: {
          appliedActions: 0,
          confirmTarget: 0,
          errors: 0,
          hold: 0,
          reassignIntervention: 0,
          rejectWrongSupplement: 0,
          scannedCandidates: 0
        },
        decisions: [],
        limit: 2000,
        message: "Identity resolved.",
        scope: "all-eligible",
        strategy: "source-led",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }),
      postIngestionRun: async (_limit, minDelayMs) => ({
        hasMoreQueued: false,
        limit: 0,
        processed: 0,
        results: [],
        safety: {
          minDelayMs
        },
        status: emptyStatus
      }),
      postIngestionStart: async () => localPipelineStartResponse(emptyStatus),
      postIngestionSynonyms: async () =>
        localPipelineStartResponse(emptyStatus, {
          existingJobs: 0,
          newJobs: 0,
          phase: "synonym",
          searchTermCount: 0
        }),
      postClaimExpansion: async () => localPipelineClaimExpansionResponse(),
      postScoreFinalization: async () => localPipelineScoreFinalizationResponse(),
      postSourceWorkRepair: async () => localPipelineSourceWorkRepairResponse()
    };

    const result = await runLocalUpdatePipeline({
      appendLog: (entry) => {
        logEntries.push(entry);
      },
      operations,
      setStageStatus: (id, status, detail) => {
        stageStatuses.set(id, status);
        stageDetails.set(id, detail);
      },
      settings: {
        leadThreshold: 70,
        rejectThreshold: 40,
        runDelayMs: 5000,
        sessionJobLimit: 100
      },
      sleepFor: async () => undefined
    });

    const buildLog = logEntries.find(
      (entry) => entry.message === "High-confidence lead build finished"
    );

    expect(result.status).toBe("completed");
    expect(stageStatuses.get("benefit-discovery")).toBe("error");
    expect(stageDetails.get("benefit-discovery")).toContain("1 error(s)");
    expect(stageDetails.get("benefit-discovery")).toContain(
      "Build leads: Ashwagandha / Stress: Claim draft failed because accepted reference ref-1 was missing."
    );
    expect(buildLog?.level).toBe("error");
    expect(buildLog?.detail).toContain("1 error(s)");
    expect(buildLog?.detail).toContain(
      "Reasons: Build leads: Ashwagandha / Stress: Claim draft failed because accepted reference ref-1 was missing."
    );
  });

  it("builds a read-only Codex review packet with source-candidate guardrails", () => {
    const data = seedDashboardData();
    const sourcePacketSummary = sourcePacketSummaryFor(data);
    const packet = buildCodexReviewPacket(data);

    expect(packet).toContain("Analyze this Apex Lifespan dashboard state.");
    expect(packet).toContain("Keep source-candidate workflows local, read-only by default");
    expect(packet).toContain("Do not accept/reject candidates");
    expect(packet).toContain("Public routes stay read-only");
    expect(packet).toContain("Use Australia/TGA as the default lens");
    expect(packet).toContain(`- Interventions: ${data.interventions.length}`);
    expect(packet).toContain(`- Claims: ${data.claims.length}`);
    expect(packet).toContain(
      `- Source packets: ${sourcePacketSummary.completeClaims}/${sourcePacketSummary.totalClaims} complete`
    );
    expect(packet).toContain("Priority scoring work:");
    expect(packet).toContain("Priority source-packet work:");
    expect(packet).toContain("Claim boundaries (what this does not prove):");
    expect(packet).toContain("Does not prove direct lifespan extension.");
    expect(packet).toContain("Does not prove safe or effective human use.");
    expect(packet).toContain("Do not perform writes or make source-candidate decisions");
  });
});

function sourcePacketSummaryFor(data: EvidenceDashboardData) {
  return summarizeClaimSourcePackets({
    claims: data.claims,
    referencesById: new Map(data.references.map((reference) => [reference.id, reference])),
    studies: data.studies
  });
}

function localPipelineStatus({
  queued,
  totalCandidates
}: {
  queued: number;
  totalCandidates: number;
}) {
  return {
    candidates: {
      counts: {
        ACCEPTED: 0,
        PENDING_REVIEW: totalCandidates,
        REJECTED: 0
      },
      recent: [],
      total: totalCandidates
    },
    queue: {
      counts: {
        FAILED: 0,
        QUEUED: queued,
        RUNNING: 0,
        SKIPPED: 0,
        SUCCEEDED: queued > 0 ? 0 : 1
      },
      recentJobs: [],
      total: queued
    },
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

function localPipelineStartResponse(
  status: ReturnType<typeof localPipelineStatus>,
  overrides: {
    existingJobs?: number;
    newJobs?: number;
    phase?: "primary" | "synonym";
    searchTermCount?: number;
  } = {}
) {
  return {
    deepeningCatchUp: {
      eligibleJobs: 0,
      existingJobs: 0,
      jobCount: 0,
      newJobs: 0,
      skippedJobs: 0
    },
    existingJobs: overrides.existingJobs ?? 0,
    interventionCount: 1,
    jobCount: overrides.newJobs ?? 0,
    newJobs: overrides.newJobs ?? 0,
    phase: overrides.phase ?? "primary",
    sampleJobs: [],
    searchTermCount: overrides.searchTermCount ?? 1,
    status
  };
}

function localPipelineAcceptedStatus({ processed }: { processed: number }) {
  return {
    counts: {
      accepted: 2,
      acceptedWithReference: 2,
      claimLinked: 1,
      missingReference: 0,
      needsClaim: 1,
      processed,
      unprocessed: 0
    },
    recent: [],
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

function localPipelineAcceptedResult({
  dedupeKey,
  linkedClaim
}: {
  dedupeKey: string;
  linkedClaim: boolean;
}) {
  return {
    acceptedReferenceId: `${dedupeKey}-ref`,
    claimId: linkedClaim ? `${dedupeKey}-claim` : undefined,
    dedupeKey,
    externalId: dedupeKey,
    interventionName: "Ashwagandha",
    linkedClaim,
    nextAction: linkedClaim ? "linked" : "needs claim",
    novelOutcomeLabels: linkedClaim ? [] : ["Stress"],
    novelTopicLabels: linkedClaim ? [] : ["Stress"],
    outcomeLabels: ["Stress"],
    processedAt: "2026-01-01T00:00:00.000Z",
    source: "PUBMED" as const,
    sourceTypeSuggestion: "Meta-analysis",
    title: "Accepted candidate",
    topicLabels: ["Stress"],
    url: "https://pubmed.ncbi.nlm.nih.gov/1/"
  };
}

function localPipelineBenefitAutomationResponse(
  strategy: "build-leads" | "link-existing" | "park-backlog",
  {
    error,
    rejectThreshold,
    threshold
  }: {
    error?: string;
    rejectThreshold: number;
    threshold: number;
  }
) {
  const errorDecision = error
    ? localPipelineBenefitAutomationDecision(strategy, error)
    : undefined;

  return {
    action: "auto-build" as const,
    applied: true,
    counts: {
      appliedActions: error ? 0 : strategy === "build-leads" ? 1 : 2,
      draftClaims: strategy === "build-leads" ? 1 : 0,
      errors: error ? 1 : 0,
      holdClusters: 0,
      linkExistingClaims: 0,
      linkedReferences: error ? 0 : strategy === "build-leads" ? 2 : 0,
      parkLeadClusters: strategy === "park-backlog" ? 1 : 0,
      rejectClusters: strategy === "park-backlog" ? 1 : 0,
      scannedClusters: error ? 1 : strategy === "build-leads" ? 1 : 2,
      skippedMismatchCandidates: 0
    },
    decisions: errorDecision ? [errorDecision] : [],
    limit: 2000,
    message: "Benefit automation complete.",
    parkThreshold: rejectThreshold,
    rejectThreshold,
    scope: "all-eligible" as const,
    strategy,
    threshold,
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

function localPipelineBenefitAutomationDecision(
  strategy: "build-leads" | "link-existing" | "park-backlog",
  error: string
) {
  const action =
    strategy === "park-backlog"
      ? ("park-lead" as const)
      : strategy === "link-existing"
        ? ("link-existing-claim" as const)
        : ("draft-claim" as const);

  return {
    action,
    applied: false,
    candidateCount: 2,
    clusterKey: `${strategy}-cluster`,
    error,
    existingClaimCount: strategy === "link-existing" ? 1 : 0,
    interventionName: "Ashwagandha",
    leadReasons: ["Test lead"],
    leadScore: strategy === "park-backlog" ? 55 : 80,
    linkedReferences: 0,
    mismatchCount: 0,
    outcomeLabel: "Stress",
    topicKey: "stress",
    topicLabel: "Stress",
    usableCandidateCount: 2
  };
}

function localPipelineScoreFinalizationResponse() {
  return {
    action: "finalize-score-ready" as const,
    applied: true,
    counts: {
      appliedUpdates: 1,
      defaultScoreReview: 0,
      errors: 0,
      readyAfter: 0,
      readyBefore: 1,
      scanned: 1,
      scoredPublicClaims: 12,
      skippedNoChange: 0,
      snapshotGaps: 0,
      sourceBlocked: 3,
      sourceBlockedWithoutNextAction: 0,
      sourceBlockers: {
        extraction_pending: 2,
        missing_sources: 0,
        not_linked: 1
      }
    },
    decisions: [
      {
        applied: true,
        claimId: "claim-ready",
        currentScoreLabel: "No final score",
        finalLabel: "Moderate" as const,
        interventionName: "Ashwagandha",
        outcome: "Stress",
        reasons: ["source packet complete"],
        snapshotCreated: true,
        suggestedScoreLabel: "6.8 Moderate",
        updatedClaim: true
      }
    ],
    limit: 500,
    message: "Applied 1 score-ready update.",
    repairSummary: {
      blockerBreakdown: [],
      extractionBatchGroups: [],
      extractionPendingRows: 2,
      extractionReadyReferenceGroups: 4,
      identityWarningReferenceGroups: 0,
      missingSourceRows: 0,
      sourceBlockedRows: 3,
      unlinkedRows: 1
    },
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

function localPipelineClaimExpansionResponse() {
  return {
    action: "expand-claims" as const,
    applied: true,
    counts: {
      claimCellsAfter: 14,
      claimCellsBefore: 12,
      claimsCreated: 2,
      errors: 0,
      groupsHeld: 0,
      groupsScanned: 2,
      heldIdentity: 1,
      heldNoOutcome: 0,
      heldRejectedDecision: 0,
      linkedExistingClaims: 1,
      linkedReferences: 5,
      sourceCandidatesAfter: 7,
      sourceCandidatesBefore: 12,
      syncedClaims: 3
    },
    decisions: [
      {
        action: "draft-claim" as const,
        applied: true,
        candidateCount: 2,
        claimCreated: true,
        claimId: "claim-expanded",
        existingClaimCount: 0,
        interventionName: "Ashwagandha",
        linkedReferences: 2,
        outcome: "sleep",
        referenceCount: 2
      }
    ],
    limit: 500,
    message: "Expanded 2 draft claims.",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

function localPipelineSourceWorkRepairResponse() {
  return {
    action: "repair-source-work" as const,
    applied: true,
    counts: {
      draftedExtractions: 3,
      errors: 0,
      heldExistingMultiStudy: 0,
      heldIdentityWarnings: 1,
      heldNoCandidate: 0,
      heldNoSourceText: 0,
      identityWarningsCovered: 1,
      scannedReferences: 4,
      sourceBlockedAfter: 2,
      sourceBlockedBefore: 5,
      syncedClaims: 2
    },
    decisions: [
      {
        action: "draft-extraction" as const,
        applied: true,
        claimCount: 1,
        referenceId: "ref-ready",
        referenceLabel: "PubMed PMID: 123",
        sourceType: "SYSTEMATIC_REVIEW",
        title: "Accepted source"
      }
    ],
    limit: 2000,
    message: "Drafted 3 source extraction rows.",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}
