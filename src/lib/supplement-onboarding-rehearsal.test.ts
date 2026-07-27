import { describe, expect, it } from "vitest";

import {
  buildSupplementOnboardingRehearsalReport,
  summarizeSupplementOnboardingRehearsalReport,
  supplementOnboardingRehearsalToMarkdown
} from "@/lib/supplement-onboarding-rehearsal";

describe("supplement onboarding rehearsal", () => {
  it("builds a read-only end-to-end onboarding rehearsal for a new supplement", () => {
    const report = buildSupplementOnboardingRehearsalReport({
      category: "Vitamin/mineral",
      claims: [
        {
          claimText: "Sleep quality support in adults with low magnesium intake.",
          outcome: "Sleep"
        }
      ],
      generatedAt: new Date("2026-06-12T00:00:00.000Z"),
      name: "Magnesium glycinate",
      synonyms: ["magnesium"]
    });

    expect(report).toMatchObject({
      generatedAt: "2026-06-12T00:00:00.000Z",
      humanOwned: true,
      noAutoPromotion: true,
      noAutoReview: true,
      noAutoWrite: true,
      readOnly: true,
      friction: {
        maxScore: 100,
        score: 21,
        tier: "low"
      },
      summary: {
        claimDrafts: 1,
        queueCommands: 1
      }
    });
    expect(report.stages.map((stage) => stage.id)).toEqual([
      "draft",
      "guardrails",
      "queue-preview",
      "readiness-after-seed",
      "review-packet-shell",
      "next-action-after-seed"
    ]);
    expect(report.stages.find((stage) => stage.id === "queue-preview")).toMatchObject({
      commands: [
        'npm run ingest:sources -- --queue-claim-sources magnesium-glycinate-sleep --region "AU"'
      ],
      status: "waiting"
    });
    expect(report.stages.find((stage) => stage.id === "next-action-after-seed"))
      .toMatchObject({
        commands: [
          'npm run onboarding:next -- --supplement "magnesium-glycinate" --summary'
        ]
      });
    expect(report.friction.items).toContainEqual(
      expect.objectContaining({
        id: "product-status",
        status: "needs-review"
      })
    );
  });

  it("keeps watchlist rehearsals blocked for review and avoids peptide self-use guidance", () => {
    const report = buildSupplementOnboardingRehearsalReport({
      category: "Peptide/biologic",
      generatedAt: new Date("2026-06-12T00:00:00.000Z"),
      name: "Example peptide",
      synonyms: ["research chemical vial", "injectable cycle"]
    });
    const markdown = supplementOnboardingRehearsalToMarkdown(report);

    expect(report.stages.find((stage) => stage.id === "guardrails")).toMatchObject({
      status: "needs-review"
    });
    expect(report.friction).toMatchObject({
      tier: "blocked"
    });
    expect(report.friction.items).toContainEqual(
      expect.objectContaining({
        id: "safety-watchlist",
        status: "blocked"
      })
    );
    expect(report.boundaries.join(" ")).toContain(
      "No full-text capture, source-term approval, individualized medical advice, dosing guidance, or peptide sourcing/self-use guidance is generated."
    );
    expect(markdown).toContain(
      "Do not include sourcing, procurement, compounding, reconstitution, injection, cycling, or self-administration guidance."
    );
  });

  it("summarizes the rehearsal without embedding the full markdown packet", () => {
    const report = buildSupplementOnboardingRehearsalReport({
      category: "Fatty acid",
      generatedAt: new Date("2026-06-12T00:00:00.000Z"),
      name: "Omega-3 EPA/DHA"
    });
    const summary = summarizeSupplementOnboardingRehearsalReport(report);

    expect(summary).toMatchObject({
      noAutoPromotion: true,
      noAutoReview: true,
      noAutoWrite: true,
      readOnly: true,
      friction: expect.objectContaining({
        maxScore: 100
      }),
      supplement: {
        id: "omega-3-epa-dha",
        slug: "omega-3-epa-dha"
      }
    });
    expect(JSON.stringify(summary)).not.toContain("planMarkdown");
    expect(summary.stages).toContainEqual(
      expect.objectContaining({
        id: "review-packet-shell",
        commands: [
          'npm run onboarding:review-packet -- --supplement "omega-3-epa-dha"'
        ]
      })
    );
    expect(supplementOnboardingRehearsalToMarkdown(report)).toContain(
      "## Friction Assessment"
    );
  });
});
