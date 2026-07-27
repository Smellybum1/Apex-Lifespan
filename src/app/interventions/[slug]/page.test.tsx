import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
import type { EvidenceDashboardData } from "@/lib/types";

vi.mock("@/lib/data/dashboard", () => ({
  getInterventionEvidenceDashboardData: vi.fn()
}));

import InterventionDetailPage from "@/app/interventions/[slug]/page";
import { getInterventionEvidenceDashboardData } from "@/lib/data/dashboard";

const getInterventionEvidenceDashboardDataMock = vi.mocked(
  getInterventionEvidenceDashboardData
);

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

describe("intervention detail page", () => {
  beforeEach(() => {
    getInterventionEvidenceDashboardDataMock.mockReset();
  });

  it("renders a citation-linked public detail view for one intervention", async () => {
    getInterventionEvidenceDashboardDataMock.mockResolvedValue(seedDashboardData());

    const html = renderToStaticMarkup(
      await InterventionDetailPage({
        params: Promise.resolve({ slug: "creatine-monohydrate" }),
        searchParams: Promise.resolve({ tab: "overview" })
      })
    );

    expect(html).toContain("Creatine monohydrate");
    expect(html).toContain("Plain-language evidence brief");
    expect(html).toContain("A reader-first summary of possible benefits");
    expect(html).toContain("What the evidence says");
    expect(html).toContain("Bottom line");
    expect(html).toContain("Overall confidence: moderate");
    expect(html).toContain("Review status: AI-assisted draft");
    expect(html).toContain("Cross-study summary");
    expect(html).toContain("The evidence as a whole");
    expect(html).toContain("Overall pattern");
    expect(html).toContain("What researchers studied");
    expect(html).toContain("How dependable is the overall picture?");
    expect(html).toContain("What this means for an average reader");
    expect(html).toContain("May help in studied settings");
    expect(html).toContain("Why confidence is limited");
    expect(html).toContain("Safety and interactions");
    expect(html).toContain("What we still do not know");
    expect(html).toContain("Australian product status");
    expect(html).toContain("Evidence trail");
    expect(html).toContain("Supporting detail: evidence by health outcome");
    expect(html).toContain('id="overview-claim-creatine-strength"');
    expect(html).toContain("What the evidence currently says");
    expect(html).toContain("Evidence base");
    expect(html).toContain("Why confidence is limited");
    expect(html).toContain("What would make this clearer");
    expect(html).toContain("Practical readout");
    expect(html).toContain("Study details, original synthesis, and audit notes");
    expect(html).toContain("Supplement context");
    expect(html).toContain("Evidence readiness");
    expect(html).toContain("Overall plain-language evidence summary");
    expect(html).toContain("Common claims: what the evidence says");
    expect(html).toContain("Study findings and conclusions");
    expect(html).toContain("Source base and article links");
    expect(html).toContain("Score index by outcome (secondary)");
    expect(html).toContain('id="claim-score-creatine-strength"');
    expect(html.indexOf("Bottom line")).toBeLessThan(html.indexOf("The evidence as a whole"));
    expect(html.indexOf("The evidence as a whole")).toBeLessThan(
      html.indexOf("Supporting detail: evidence by health outcome")
    );
    expect(html.indexOf("Supporting detail: evidence by health outcome")).toBeLessThan(
      html.indexOf("Study details, original synthesis, and audit notes")
    );
    expect(html.indexOf("Study details, original synthesis, and audit notes")).toBeLessThan(
      html.indexOf("Overall plain-language evidence summary")
    );
    expect(html).toContain("Summary");
    expect(html).toContain("Full detail");
    expect(html).toContain("Claims");
    expect(html).toContain("Sources");
    expect(html).toContain("Safety &amp; trials");
    expect(html).toContain("Audit");
    expect(html).toContain('href="/interventions/creatine-monohydrate"');
    expect(html).toContain('href="/interventions/creatine-monohydrate?tab=claims"');
    expect(html).toContain('href="/interventions/creatine-monohydrate?tab=sources"');
    expect(html).toContain('href="/interventions/creatine-monohydrate?tab=safety"');
    expect(html).toContain('href="/interventions/creatine-monohydrate?tab=audit"');
    expect(html).not.toContain("Claim-by-claim evidence notes");
    expect(html).not.toContain("Source extraction:");
    expect(html).not.toContain("Trial watcher");
    expect(html).not.toContain("Score/audit history");
  });

  it("defaults to the plain-language reader brief when no tab is requested", async () => {
    getInterventionEvidenceDashboardDataMock.mockResolvedValue(seedDashboardData());

    const html = renderToStaticMarkup(
      await InterventionDetailPage({ params: Promise.resolve({ slug: "creatine-monohydrate" }) })
    );

    expect(html).toContain("Creatine monohydrate");
    expect(html).toContain("Also called creatine, creatine hydrate");
    expect(html).toContain("The short answer");
    expect(html).toContain("May help, in the right situation");
    expect(html).toContain(
      "Creatine monohydrate has reasonable evidence for muscle and strength, but it depends on who you are and what you are taking it for."
    );
    expect(html).toContain("Research on file");
    expect(html).toContain("Checked by a person");
    expect(html).toContain("0 of 2 conclusions");
    expect(html).toContain("What it may help with");
    expect(html).toContain(
      "Ranked by how good the evidence is. Anything not listed here has no reviewed conclusion yet."
    );
    expect(html).toContain("Muscle and strength");
    expect(html).toContain("Decent evidence, with conditions");
    expect(html).toContain("Draft — not yet reviewed by a person");
    expect(html).toContain("What it will not do");
    expect(html).toContain(
      "Nothing here shows that Creatine monohydrate makes you live longer."
    );
    expect(html).toContain("Where this comes from");
    expect(html).toContain("Full evidence detail and sources");
    expect(html).toContain("How we rate evidence");
    expect(html).toContain('href="/interventions/creatine-monohydrate?tab=overview"');

    // The brief renders its own layout: no audit-view chrome and no tab bar.
    expect(html).not.toContain("Plain-language evidence brief");
    expect(html).not.toContain("Score index by outcome (secondary)");
    expect(html).not.toContain("Evidence readiness");
    expect(html).not.toContain("Supporting detail: evidence by health outcome");
    expect(html).not.toContain("Full detail");
    expect(html).not.toContain('href="/interventions/creatine-monohydrate?tab=claims"');
    expect(html).not.toContain('href="/interventions/creatine-monohydrate?tab=audit"');
  });

  it("lists unreviewed pipeline outcomes separately on the default brief", async () => {
    const data = seedDashboardData();

    getInterventionEvidenceDashboardDataMock.mockResolvedValue({
      ...data,
      claims: [
        ...data.claims,
        {
          ...data.claims[0],
          id: "creatine-cognition-leads",
          interventionId: "creatine",
          outcome: "Cognition" as const,
          claimText:
            "Creatine monohydrate has accepted source leads for cognition that need structured evidence review.",
          keyReferenceIds: []
        }
      ]
    });

    const html = renderToStaticMarkup(
      await InterventionDetailPage({ params: Promise.resolve({ slug: "creatine-monohydrate" }) })
    );

    expect(html).toContain("Still being worked through");
    expect(html).toContain(
      "Studies have been gathered for these, but nobody has reviewed them into a conclusion yet."
    );
    expect(html).toContain("Memory and thinking");
    expect(html).toContain(
      "Research on 1 other area has been collected but not reviewed yet."
    );
  });

  it("turns low-confidence Folic Acid source leads into a reader-first brief", async () => {
    const data = seedDashboardData();
    const baseClaim = data.claims[0];
    const baseReference = data.references[0];
    const baseStudy = data.studies[0];
    const rawExtraction =
      "Representative extracted text: prenatal micronutrients changed a neonatal outcome that does not match this claim.";
    const workflowText =
      "What would change the score: review accepted sources and confirm outcome matching.";
    const outcomeSpecs = [
      {
        id: "folic-acid-glucose",
        outcome: "Glucose/insulin/HbA1c" as const,
        referenceId: "ref-folic-glucose",
        sourceTypeTaxonomy: "meta-analysis" as const,
        studyType: "Meta-analysis" as const,
        title: "Folic acid and glycemic outcomes: systematic review"
      },
      {
        id: "folic-acid-cv",
        outcome: "Cardiovascular events" as const,
        referenceId: "ref-folic-cv",
        sourceTypeTaxonomy: "meta-analysis" as const,
        studyType: "Meta-analysis" as const,
        title: "Folic acid and cardiovascular outcomes: meta-analysis"
      },
      {
        id: "folic-acid-inflammation",
        outcome: "Inflammation" as const,
        referenceId: "ref-folic-inflammation",
        sourceTypeTaxonomy: "systematic review" as const,
        studyType: "Systematic review" as const,
        title: "Folic acid and inflammatory markers: systematic review"
      },
      {
        id: "folic-acid-fertility",
        outcome: "Fertility/hormones" as const,
        referenceId: "ref-folic-fertility",
        sourceTypeTaxonomy: "RCT" as const,
        studyType: "Randomized controlled trial" as const,
        title: "Folic acid and reproductive outcomes: systematic review"
      }
    ];
    const folicReferences = outcomeSpecs.map((spec, index) => ({
      ...baseReference,
      id: spec.referenceId,
      identifier: `PMID: 4000000${index}`,
      title: spec.title,
      url: `https://pubmed.ncbi.nlm.nih.gov/4000000${index}/`
    }));
    const folicClaims = outcomeSpecs.map((spec, index) => ({
      ...baseClaim,
      id: spec.id,
      interventionId: "folic-acid",
      outcome: spec.outcome,
      claimText: `${spec.outcome} support.`,
      confidenceLevel: "Very low" as const,
      finalLabel: "Useful for Specific Use Case" as const,
      keyReferenceIds: [spec.referenceId],
      reviewStatus: "Unreviewed AI draft" as const,
      summary: `Folic acid has source leads for ${spec.outcome}, but this is not a settled conclusion. ${rawExtraction}`,
      uncertainty: `Uncertainty remains because source relevance still needs review. ${workflowText}`,
      scores: {
        ...baseClaim.scores,
        effectSize: 7 - index
      }
    }));
    const safetyClaim = {
      ...baseClaim,
      id: "folic-acid-safety",
      interventionId: "folic-acid",
      outcome: "Safety/adverse effects" as const,
      claimText: "General safety, tolerability, interaction, and product-quality profile.",
      confidenceLevel: "Very low" as const,
      finalLabel: "Safety Concern" as const,
      keyReferenceIds: [],
      reviewStatus: "Unreviewed AI draft" as const,
      summary:
        "Safety evidence remains incomplete and should be kept separate from possible benefits.",
      uncertainty:
        "Interaction, pregnancy, medication, and product-level safety are not established."
    };
    const folicStudies = outcomeSpecs.map((spec, index) => ({
      ...baseStudy,
      id: `study-${spec.id}`,
      intervention: "Folic acid",
      mainResults: rawExtraction,
      outcomes: [spec.outcome],
      referenceId: spec.referenceId,
      sourceTypeTaxonomy: spec.sourceTypeTaxonomy,
      studyType: spec.studyType,
      title: spec.title,
      year: 2020 + index
    }));

    getInterventionEvidenceDashboardDataMock.mockResolvedValue({
      ...data,
      claims: [...folicClaims, safetyClaim],
      interventions: [
        {
          ...data.interventions[0],
          evidenceSummary: "Generated catalog summary that should not lead the reader view.",
          id: "folic-acid",
          interactionSummary: "Interaction and medication context has not been fully reviewed.",
          name: "Folic acid / folate",
          safetySummary: "Safety evidence has not been fully reviewed.",
          slug: "folic-acid"
        }
      ],
      references: folicReferences,
      studies: folicStudies
    });

    const html = renderToStaticMarkup(
      await InterventionDetailPage({
        params: Promise.resolve({ slug: "folic-acid" }),
        searchParams: Promise.resolve({ tab: "overview" })
      })
    );
    const crossStudyStart = html.indexOf("Cross-study summary");
    const outcomeSectionStart = html.indexOf("Supporting detail: evidence by health outcome");
    const crossStudySummary = html.slice(crossStudyStart, outcomeSectionStart);
    const glucoseCardStart = html.indexOf('id="overview-claim-folic-acid-glucose"');
    const glucoseCardEnd = html.indexOf('id="overview-claim-', glucoseCardStart + 1);
    const glucoseCard = html.slice(
      glucoseCardStart,
      glucoseCardEnd === -1 ? html.indexOf("Safety and interactions") : glucoseCardEnd
    );

    expect(html).toContain("Overall confidence: low");
    expect(html).toContain("Review status: AI-assisted draft");
    expect(html).toContain(
      "The local evidence does not yet support a clear, settled health benefit for Folic acid / folate."
    );
    expect(crossStudyStart).toBeGreaterThan(-1);
    expect(crossStudyStart).toBeLessThan(outcomeSectionStart);
    expect(crossStudySummary).toContain("The evidence as a whole");
    expect(crossStudySummary).toContain("links 4 articles and contains 4 extracted study records");
    expect(crossStudySummary).toContain("2 meta-analyses");
    expect(crossStudySummary).toContain("1 systematic review");
    expect(crossStudySummary).toContain("1 RCT");
    expect(crossStudySummary).toContain("5 of 5 scoped conclusions are low or very-low confidence");
    expect(crossStudySummary).toContain("0 have recorded human review");
    expect(crossStudySummary).toContain("does not yet add up to a dependable overall health-benefit conclusion");
    expect(crossStudySummary).toContain("A large number of studies does not by itself make the conclusion reliable");
    expect(crossStudySummary).toContain("What this means for an average reader");
    expect(crossStudySummary).not.toContain(rawExtraction);
    expect(crossStudySummary).not.toContain(workflowText);
    expect(html).toContain('id="overview-claim-folic-acid-glucose"');
    expect(html).toContain('id="overview-claim-folic-acid-cv"');
    expect(html).toContain('id="overview-claim-folic-acid-inflammation"');
    expect(html).toContain('id="overview-claim-folic-acid-fertility"');
    expect(html).toContain('id="overview-claim-folic-acid-safety"');
    expect(glucoseCard).toContain("Score ");
    expect(glucoseCard).toContain("Very low confidence");
    expect(glucoseCard).toContain("1 linked article and 1 extracted study record");
    expect(glucoseCard).toContain("1 meta-analysis");
    expect(glucoseCard).toContain("Why confidence is limited");
    expect(glucoseCard).toContain("What would make this clearer");
    expect(glucoseCard).toContain("Population, dose or form, duration, comparator, product quality, and AU/TGA product status");
    expect(glucoseCard).toContain("Stored claim summary (draft wording)");
    expect(glucoseCard).toContain("Representative source extract — outcome match may still need review");
    expect(glucoseCard).toContain(rawExtraction);
    expect(glucoseCard).toContain(workflowText);
    expect(html).toContain("Safety evidence has not been fully reviewed.");
    expect(html).toContain("No local safety alerts were found. This does not mean the supplement is safe.");
    expect(html).toContain(
      "Ingredient-level evidence does not confirm the safety, quality, effectiveness, or AUST/ARTG status of a particular product."
    );
    expect(html).toContain('href="/interventions/folic-acid?tab=claims#claim-folic-acid-glucose"');
    expect(html).toContain('href="/interventions/folic-acid?tab=sources"');
    expect(html.indexOf(rawExtraction)).toBeGreaterThan(
      html.indexOf("Supporting detail: evidence by health outcome")
    );
  });

  it("renders detailed claim notes only on the claims tab", async () => {
    getInterventionEvidenceDashboardDataMock.mockResolvedValue(seedDashboardData());

    const html = renderToStaticMarkup(
      await InterventionDetailPage({
        params: Promise.resolve({ slug: "creatine-monohydrate" }),
        searchParams: Promise.resolve({ tab: "claims" })
      })
    );

    expect(html).toContain("Claim-by-claim evidence notes");
    expect(html).toContain('id="claim-creatine-strength"');
    expect(html).toContain("Selected from the ranked evidence map");
    expect(html).toContain("Source extraction:");
    expect(html).toContain("1/1 references extracted");
    expect(html).toContain("Component score breakdown");
    expect(html).toContain("Draft composite");
    expect(html).toContain("AI Draft Classification: Core Evidence-Based");
    expect(html).toContain("Pending human review");
    expect(html).toContain("Higher is better for every component shown here.");
    expect(html).toContain('href="/methodology#score-components"');
    expect(html).toContain("Directness");
    expect(html).toContain("Rigor");
    expect(html).toContain("Impact");
    expect(html).toContain("Safety");
    expect(html).toContain("Measurability");
    expect(html).toContain("Low regulatory risk");
    expect(html).toContain("Low hype risk");
    expect(html).toContain('role="meter"');
    expect(html).toContain("What this does not prove");
    expect(html).toContain("PubMed - PMID: 28615996");
    expect(html).not.toContain("Source trail");
    expect(html).not.toContain("Trial watcher");
    expect(html).not.toContain("Score/audit history");
  });

  it("surfaces claim summaries before score components on click-through claim cards", async () => {
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

    getInterventionEvidenceDashboardDataMock.mockResolvedValue({
      ...data,
      claims: [caffeineClaim],
      interventions: [
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
        {
          ...data.studies[0],
          id: "study-caffeine-sleep",
          intervention: "Caffeine",
          outcomes: ["Sleep timing", "Sleep continuity", "Sleep quality"],
          referenceId: reference.id,
          title: "The effect of caffeine on subsequent sleep"
        }
      ]
    });

    const html = renderToStaticMarkup(
      await InterventionDetailPage({
        params: Promise.resolve({ slug: "caffeine" }),
        searchParams: Promise.resolve({ tab: "claims" })
      })
    );

    expect(html).toContain("What this evidence appears to say");
    expect(html).toContain("Caution/adverse signal");
    expect(html).toContain(
      "The clearest sleep-related conclusion is adverse: caffeine can impair sleep timing, continuity, or quality depending on timing and individual sensitivity."
    );
    expect(html).toContain(
      "Sleep effects depend on dose timing, metabolism, tolerance, baseline sleep, and co-use with other stimulants"
    );
    expect(html).toContain("Read the score cautiously");
    expect(html).toContain("the number is a draft audit score, not a recommendation or proof of benefit");
    expect(html).toContain("What would change this score");
    expect(html.indexOf("What this evidence appears to say")).toBeLessThan(
      html.indexOf("Component score breakdown")
    );
  });

  it("keeps an Astaxanthin skin readout source-traceable and bounded", async () => {
    const data = seedDashboardData();
    const reference = {
      ...data.references[0],
      id: "ref-pubmed-34578794",
      identifier: "PMID: 34578794",
      title: "Systematic Review and Meta-Analysis on the Effects of Astaxanthin on Human Skin Ageing",
      url: "https://pubmed.ncbi.nlm.nih.gov/34578794/",
      year: 2021
    };
    const summary =
      "One linked 2021 systematic review/meta-analysis (PMID 34578794) included 11 human skin-ageing studies: nine randomized trials and two open-label studies. In the pooled oral trials, astaxanthin improved skin moisture and elasticity versus placebo, but wrinkle depth did not improve significantly. This supports only a low-certainty skin readout; the source does not establish joint or tendon benefit.";
    const uncertainty =
      "Studies varied in dose, duration, and oral, topical, or combined use; pooled results had moderate heterogeneity for moisture and high heterogeneity for elasticity, while open-label evidence was weaker. Safety reporting and funding/conflict details are not fully extracted locally. The findings do not establish broad anti-ageing benefit, effectiveness or safety for a specific product, or product-level AUST/ARTG status; this row remains an unreviewed AI draft.";
    const astaxanthinClaim = {
      ...data.claims[0],
      id: "astaxanthin-joint-tendon-skin",
      interventionId: "astaxanthin",
      outcome: "Joint/tendon/skin" as const,
      claimText: "Joint, tendon, connective-tissue, or skin-health support.",
      confidenceLevel: "Very low" as const,
      evidenceGrade: "Scored from linked source packet; pending human review.",
      finalLabel: "Useful for Specific Use Case" as const,
      keyReferenceIds: [reference.id],
      reviewStatus: "Unreviewed AI draft" as const,
      summary,
      uncertainty
    };

    getInterventionEvidenceDashboardDataMock.mockResolvedValue({
      ...data,
      claims: [astaxanthinClaim],
      interventions: [
        {
          ...data.interventions[0],
          evidenceSummary:
            "The current local human readout is limited to source-specific skin outcomes.",
          id: "astaxanthin",
          name: "Astaxanthin",
          slug: "astaxanthin"
        }
      ],
      references: [reference],
      studies: [
        {
          ...data.studies[0],
          adverseEvents:
            "Adverse-event details were not the main local extraction focus; keep product and form boundaries visible.",
          fundingConflicts: "Check the full source record before promotion.",
          id: "study-astaxanthin-skin-aging",
          intervention: "Astaxanthin",
          mainResults:
            "Oral astaxanthin improved moisture and elasticity versus placebo, while wrinkle-depth reduction was not statistically significant.",
          outcomes: ["Skin ageing", "Moisture", "Elasticity"],
          population: "Human participants in skin-ageing studies.",
          referenceId: reference.id,
          riskOfBias:
            "Heterogeneity was moderate for moisture and high for elasticity; open-label evidence was weaker.",
          sampleSize:
            "11 human studies: nine randomized trials and two open-label studies; eight oral RCTs were pooled.",
          studyType: "Meta-analysis" as const,
          title: reference.title,
          year: 2021
        }
      ]
    });

    const overviewHtml = renderToStaticMarkup(
      await InterventionDetailPage({
        params: Promise.resolve({ slug: "astaxanthin" }),
        searchParams: Promise.resolve({ tab: "overview" })
      })
    );
    const claimsHtml = renderToStaticMarkup(
      await InterventionDetailPage({
        params: Promise.resolve({ slug: "astaxanthin" }),
        searchParams: Promise.resolve({ tab: "claims" })
      })
    );

    expect(overviewHtml).toContain(summary);
    expect(overviewHtml).toContain("This is based on 1 linked article and 1 extracted study row.");
    expect(overviewHtml).toContain(`Uncertainty: ${uncertainty}`);
    expect(claimsHtml).toContain(summary);
    expect(claimsHtml).toContain(uncertainty);
    expect(claimsHtml).toContain("Pending human review");
    expect(claimsHtml).not.toContain("Caution/adverse signal");
    expect(claimsHtml).toContain("PubMed - PMID: 34578794");
    expect(claimsHtml).toContain("https://pubmed.ncbi.nlm.nih.gov/34578794/");
    expect(claimsHtml.indexOf("What this evidence appears to say")).toBeLessThan(
      claimsHtml.indexOf("Component score breakdown")
    );
  });

  it("keeps adverse-direction claims out of the full-detail brief's benefit framing", async () => {
    const data = seedDashboardData();
    const reference = data.references[0];
    const caffeineClaim = {
      ...data.claims[0],
      id: "caffeine-sleep",
      interventionId: "caffeine",
      outcome: "Sleep" as const,
      claimText: "Sleep quality or sleep-continuity support.",
      confidenceLevel: "Moderate" as const,
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

    getInterventionEvidenceDashboardDataMock.mockResolvedValue({
      ...data,
      claims: [caffeineClaim],
      interventions: [
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
        {
          ...data.studies[0],
          id: "study-caffeine-sleep",
          intervention: "Caffeine",
          outcomes: ["Sleep timing", "Sleep continuity", "Sleep quality"],
          referenceId: reference.id,
          title: "The effect of caffeine on subsequent sleep"
        }
      ]
    });

    const html = renderToStaticMarkup(
      await InterventionDetailPage({
        params: Promise.resolve({ slug: "caffeine" }),
        searchParams: Promise.resolve({ tab: "overview" })
      })
    );

    expect(html).toContain("1 caution or adverse signal is tracked.");
    expect(html).toContain("Evidence direction: Caution/adverse signal");
    expect(html).toContain("Possible risk");
    expect(html).toContain("Sleep carries a caution/adverse signal, not a benefit read:");
    expect(html).toContain("moderate confidence, caution/adverse signal");
    expect(html).toContain("Sleep (caution/adverse signal):");
    expect(html).not.toContain("Sleep: The clearest sleep-related conclusion");
    expect(html).not.toContain("stands out most for Sleep");
  });

  it("renders source, safety, and audit tabs as separate heavier views", async () => {
    getInterventionEvidenceDashboardDataMock.mockResolvedValue(seedDashboardData());

    const sourcesHtml = renderToStaticMarkup(
      await InterventionDetailPage({
        params: Promise.resolve({ slug: "creatine-monohydrate" }),
        searchParams: Promise.resolve({ tab: "sources" })
      })
    );
    const safetyHtml = renderToStaticMarkup(
      await InterventionDetailPage({
        params: Promise.resolve({ slug: "creatine-monohydrate" }),
        searchParams: Promise.resolve({ tab: "safety" })
      })
    );
    const auditHtml = renderToStaticMarkup(
      await InterventionDetailPage({
        params: Promise.resolve({ slug: "creatine-monohydrate" }),
        searchParams: Promise.resolve({ tab: "audit" })
      })
    );

    expect(sourcesHtml).toContain("Source trail");
    expect(sourcesHtml).toContain('tabindex="0"');
    expect(sourcesHtml).toContain("position stand");
    expect(sourcesHtml).toContain("PMID: 28615996");
    expect(sourcesHtml).toContain("https://pubmed.ncbi.nlm.nih.gov/28615996/");

    expect(safetyHtml).toContain("Safety alerts");
    expect(safetyHtml).toContain("Trial watcher");
    expect(safetyHtml).toContain("AU/TGA and product context");
    expect(safetyHtml).toContain("Direct match");
    expect(safetyHtml).toContain("Registry records are review leads only");
    expect(safetyHtml).toContain("NCTSEED-CREATINE");

    expect(auditHtml).toContain("Score/audit history");
    expect(auditHtml).toContain("What would change the score");
  });

  it("keeps review-work claim rows from looking like final scored evidence", async () => {
    const data = seedDashboardData();
    const creatine = data.interventions.find((item) => item.slug === "creatine-monohydrate");

    getInterventionEvidenceDashboardDataMock.mockResolvedValue({
      ...data,
      claims: data.claims.map((claim) =>
        claim.interventionId === creatine?.id ? { ...claim, evidenceGrade: "Draft lead" } : claim
      )
    });

    const html = renderToStaticMarkup(
      await InterventionDetailPage({
        params: Promise.resolve({ slug: "creatine-monohydrate" }),
        searchParams: Promise.resolve({ tab: "claims" })
      })
    );

    expect(html).toContain("Composite pending");
    expect(html).toContain("Review work");
    expect(html).toContain("Review-needed classification");
    expect(html).toContain("Starter component values are hidden here until the claim is scored");
  });

  it("marks scored-looking detail claims as source work when extraction is incomplete", async () => {
    const data = seedDashboardData();
    const creatine = data.interventions.find((item) => item.slug === "creatine-monohydrate");
    const targetClaim = data.claims.find(
      (claim) => claim.interventionId === creatine?.id && claim.keyReferenceIds.length > 0
    );

    expect(targetClaim).toBeDefined();

    getInterventionEvidenceDashboardDataMock.mockResolvedValue({
      ...data,
      studies: data.studies.filter(
        (study) => !targetClaim?.keyReferenceIds.includes(study.referenceId)
      )
    });

    const html = renderToStaticMarkup(
      await InterventionDetailPage({
        params: Promise.resolve({ slug: "creatine-monohydrate" }),
        searchParams: Promise.resolve({ tab: "claims" })
      })
    );

    expect(html).toContain("Source work");
    expect(html).toContain("Composite source work");
    expect(html).toContain("Stored score needs source extraction");
    expect(html).toContain("Extraction pending");
    expect(html).toContain("Source-work classification");
    expect(html).toContain("stored score and component values are hidden here");
    expect(html).toContain("linked references still need extraction or source-packet repair");
    expect(html).toContain("Source extraction:");
    expect(html).toContain("0/1 references extracted; 1 pending extraction");
    expect(html).toContain("Next source step:");
    expect(html).toContain(
      "Add structured extraction for the pending references before treating this packet as complete."
    );
  });

  it("explains no-source detail rows as sourcing work instead of evidence-backed conclusions", async () => {
    const data = seedDashboardData();
    const creatine = data.interventions.find((item) => item.slug === "creatine-monohydrate");
    const targetClaim = data.claims.find(
      (claim) => claim.interventionId === creatine?.id && claim.keyReferenceIds.length > 0
    );

    expect(targetClaim).toBeDefined();

    getInterventionEvidenceDashboardDataMock.mockResolvedValue({
      ...data,
      claims: data.claims.map((claim) =>
        claim.id === targetClaim?.id
          ? {
              ...claim,
              evidenceGrade: "Draft lead",
              keyReferenceIds: []
            }
          : claim
      )
    });

    const overviewHtml = renderToStaticMarkup(
      await InterventionDetailPage({
        params: Promise.resolve({ slug: "creatine-monohydrate" }),
        searchParams: Promise.resolve({ tab: "overview" })
      })
    );
    const claimsHtml = renderToStaticMarkup(
      await InterventionDetailPage({
        params: Promise.resolve({ slug: "creatine-monohydrate" }),
        searchParams: Promise.resolve({ tab: "claims" })
      })
    );

    expect(overviewHtml).toContain("Not enough data");
    expect(overviewHtml).toContain(
      "Some linked evidence has not been fully extracted or checked yet."
    );
    expect(overviewHtml).toContain("Evidence still being checked");
    expect(overviewHtml).toContain("Where the evidence record is incomplete");
    expect(overviewHtml).toContain("Outcomes with a displayed score");
    expect(overviewHtml).toContain("Outcomes still blocked");
    expect(overviewHtml).toContain("Treat this as a sourcing task, not an evidence-backed conclusion.");
    expect(claimsHtml).toContain("No curated sources");
    expect(claimsHtml).toContain("no curated references linked");
    expect(claimsHtml).toContain("No citation links are attached to this claim yet.");
    expect(claimsHtml).toContain("Add curated reference links before treating this claim as source-backed.");
  });

  it("marks complete source packets as ready to score without showing placeholder components", async () => {
    const data = seedDashboardData();
    const creatine = data.interventions.find((item) => item.slug === "creatine-monohydrate");
    const targetClaim = data.claims.find(
      (claim) => claim.interventionId === creatine?.id && claim.keyReferenceIds.length > 0
    );

    expect(targetClaim).toBeDefined();

    getInterventionEvidenceDashboardDataMock.mockResolvedValue({
      ...data,
      claims: data.claims.map((claim) =>
        claim.id === targetClaim?.id
          ? { ...claim, evidenceGrade: "Insufficient until source packets are reviewed." }
          : claim
      )
    });

    const html = renderToStaticMarkup(
      await InterventionDetailPage({
        params: Promise.resolve({ slug: "creatine-monohydrate" }),
        searchParams: Promise.resolve({ tab: "claims" })
      })
    );

    expect(html).toContain("Composite ready to score");
    expect(html).toContain("Ready to score");
    expect(html).toContain("Complete packet awaiting score assignment");
    expect(html).toContain("Ready-to-score classification");
    expect(html).toContain("Use the complete source packet to assign dimension scores");
    expect(html).toContain("stored placeholder score and component values are hidden here");
  });

  it("renders magnesium sleep coverage with trial registry labels", async () => {
    getInterventionEvidenceDashboardDataMock.mockResolvedValue(seedDashboardData());

    const claimsHtml = renderToStaticMarkup(
      await InterventionDetailPage({
        params: Promise.resolve({ slug: "magnesium" }),
        searchParams: Promise.resolve({ tab: "claims" })
      })
    );
    const safetyHtml = renderToStaticMarkup(
      await InterventionDetailPage({
        params: Promise.resolve({ slug: "magnesium" }),
        searchParams: Promise.resolve({ tab: "safety" })
      })
    );
    const sourcesHtml = renderToStaticMarkup(
      await InterventionDetailPage({
        params: Promise.resolve({ slug: "magnesium" }),
        searchParams: Promise.resolve({ tab: "sources" })
      })
    );

    expect(claimsHtml).toContain("Magnesium");
    expect(claimsHtml).toContain("Sleep quality support in adults with low habitual intake or measured insufficiency.");
    expect(claimsHtml).toContain("AI Draft Classification: Insufficient Evidence");
    expect(claimsHtml).toContain("Does not prove insomnia treatment for all adults.");
    expect(claimsHtml).toContain("https://ods.od.nih.gov/factsheets/Magnesium-HealthProfessional/");
    expect(sourcesHtml).toContain("review/position-stand source extracted");
    expect(sourcesHtml).toContain("Magnesium health professional fact sheet");
    expect(safetyHtml).toContain("Trial watcher");
    expect(safetyHtml).toContain("NCTSEED-MAGSLEEP");
    expect(safetyHtml).toContain("Direct match");
    expect(safetyHtml).toContain("Results posted");
    expect(safetyHtml).toContain("Pittsburgh Sleep Quality Index");
  });
});
