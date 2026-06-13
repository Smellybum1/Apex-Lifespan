import type { Metadata } from "next";
import Link from "next/link";

import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Methodology & Score Legend | Apex Lifespan",
  description:
    "How Apex Lifespan scores supplement, peptide, and healthspan-intervention claims."
};

const anchorLinks = [
  ["Core Principle", "core-principle"],
  ["Score Components", "score-components"],
  ["Composite Score", "composite-score"],
  ["Score Bands", "score-bands"],
  ["Final Labels", "final-labels"],
  ["Evidence Hierarchy", "evidence-hierarchy"],
  ["Peptide Policy", "peptide-policy"],
  ["Review Status", "review-status"],
  ["Score Changes", "score-changes"],
  ["Limitations", "limitations"]
] as const;

const scoreComponents = [
  {
    definition:
      "How closely the evidence matches the exact claim being scored.",
    increases:
      "Same intervention, dose/form, population, outcome, comparator, and timeframe.",
    lowers:
      "Indirect endpoints, different forms, animal-only evidence, broad extrapolation, or a mismatched population.",
    name: "Directness"
  },
  {
    definition:
      "The strength and reliability of the study design and extraction quality.",
    increases:
      "Large randomized trials, consistent systematic reviews, clear comparators, and low bias concerns.",
    lowers:
      "Small uncontrolled studies, weak comparators, unclear methods, selective reporting, or poor extraction detail.",
    name: "Rigor"
  },
  {
    definition:
      "The practical size and importance of the observed or plausible effect.",
    increases:
      "Clinically meaningful outcomes, replicated effects, and endpoints users can understand.",
    lowers:
      "Tiny effects, surrogate-only changes, unclear clinical meaning, or outcomes far from the claim.",
    name: "Impact"
  },
  {
    definition:
      "Captured adverse-event, interaction, population-risk, and safety-signal context.",
    increases:
      "Benign safety profile in the relevant population, clear tolerability data, and low interaction concern.",
    lowers:
      "Known adverse-event signals, drug interactions, high-risk populations, uncertainty, or narrow safety margins.",
    name: "Safety"
  },
  {
    definition:
      "Whether the claim can be checked with clear endpoints, biomarkers, or trial outcomes.",
    increases:
      "Objective biomarkers, functional measures, registry outcomes, or validated clinical endpoints.",
    lowers:
      "Vague wellness wording, subjective claims without measures, or hard-to-observe promises.",
    name: "Measurability"
  },
  {
    definition:
      "How much the claim avoids promotional overreach or unsupported lifespan extrapolation.",
    increases:
      "Scoped wording, clear caveats, and separation between evidence-backed claims and speculation.",
    lowers:
      "Anti-aging hype, cure-all language, influencer claims, or claims broader than the cited evidence.",
    name: "Low hype risk"
  },
  {
    definition:
      "How little product, supply, legal, and regulator-context concern is attached to the claim or intervention.",
    increases:
      "Clear product-level regulatory evidence, low supply concern, and no captured warning signals.",
    lowers:
      "Unapproved therapeutic status, peptide/watchlist context, major safety warnings, or unresolved product status.",
    name: "Low regulatory risk"
  }
];

const compositeWeights = [
  ["Directness", "20%"],
  ["Rigor", "20%"],
  ["Impact", "20%"],
  ["Safety", "20%"],
  ["Measurability", "10%"],
  ["Low hype risk", "10%"]
] as const;

const implementationWeights = [
  ["Directness", "22%"],
  ["Rigor", "22%"],
  ["Impact", "18%"],
  ["Safety", "14%"],
  ["Low regulatory risk", "10%"],
  ["Low hype risk", "8%"],
  ["Measurability", "6%"]
] as const;

const scoreBands = [
  ["8.0-10", "Strong"],
  ["6.0-7.9", "Moderate"],
  ["4.0-5.9", "Limited"],
  ["2.0-3.9", "Weak"],
  ["0-1.9", "Very weak / concern"]
] as const;

const finalLabels = [
  [
    "Core Evidence-Based",
    "Strong, direct evidence for the scoped claim, with safety and regulatory caveats still visible."
  ],
  [
    "Useful for Specific Use Case",
    "Evidence is useful for a narrow endpoint or context, but should not be generalized."
  ],
  [
    "Conditional / Biomarker-Gated",
    "Best interpreted when baseline status, labs, risk group, or product form matches the evidence."
  ],
  [
    "Reasonable N-of-1 Experiment",
    "May be reasonable to track personally in low-risk contexts, but remains uncertain and not medical advice."
  ],
  [
    "Speculative Watchlist",
    "Interesting but early, indirect, mechanistic, or incomplete evidence."
  ],
  [
    "Insufficient Evidence",
    "Current evidence does not support the claim well enough for a positive label."
  ],
  [
    "Safety Concern",
    "Safety signals materially affect interpretation and may outweigh potential benefit."
  ],
  [
    "Regulatory Concern",
    "Regulatory or product-status concerns are central to the card and can override evidence enthusiasm."
  ],
  [
    "Requires Clinician Oversight",
    "The claim or intervention belongs in clinician-reviewed context rather than ordinary consumer self-use."
  ]
] as const;

const evidenceHierarchy = [
  "Large RCTs with clinical outcomes",
  "Systematic reviews/meta-analyses",
  "Smaller RCTs",
  "Human biomarker trials",
  "Observational studies",
  "Case reports",
  "Animal studies",
  "In vitro/mechanistic evidence",
  "Marketing/influencer claims"
] as const;

const reviewStatuses = [
  [
    "Unreviewed extraction",
    "A structured extraction or source lead exists, but it has not been checked by a human reviewer."
  ],
  [
    "Citation checked",
    "The citation, source identity, and basic relevance have been checked, but the claim may still need deeper review."
  ],
  [
    "Human reviewed",
    "A human reviewer checked the source packet against the scoped claim. This does not mean clinical guideline endorsed."
  ],
  [
    "Needs update",
    "New evidence, safety information, product context, or regulatory status may require re-review."
  ],
  [
    "Retired / superseded",
    "The card or source packet has been replaced, withdrawn, or is no longer the best representation of the evidence."
  ]
] as const;

const scoreChangeReasons = [
  "New RCT",
  "New meta-analysis",
  "Trial result posted",
  "Regulatory warning",
  "Safety signal",
  "Contradictory evidence",
  "Better dose/form-specific evidence",
  "Product-quality concern"
] as const;

const examples = [
  {
    detail:
      "Strong for strength, power, and lean mass support when paired with resistance training; insufficient for direct lifespan extension.",
    title: "Creatine"
  },
  {
    detail:
      "Strongest for correcting deficiency or low status; weak or conditional for longevity in already-sufficient adults.",
    title: "Vitamin D"
  },
  {
    detail:
      "Speculative/regulatory concern, not an ordinary supplement card; human evidence and approved-use context stay central.",
    title: "BPC-157"
  }
] as const;

export default function MethodologyPage() {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="inline-flex rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-signal hover:text-signal"
        >
          Back to dashboard
        </Link>

        <header className="mt-4 border-b border-line pb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Scoring methodology
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-ink">
            Methodology &amp; Score Legend
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-700">
            How Apex Lifespan scores supplement, peptide, and healthspan-intervention claims.
          </p>
        </header>

        <nav
          aria-label="Methodology sections"
          className="mt-5 flex flex-wrap gap-2 text-xs font-semibold"
        >
          {anchorLinks.map(([label, id]) => (
            <a
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:border-signal hover:text-signal"
              href={`#${id}`}
              key={id}
            >
              {label}
            </a>
          ))}
        </nav>

        <section className="mt-8" id="core-principle">
          <SectionHeading
            eyebrow="Core Principle"
            title="Apex scores claims, not compounds."
          />
          <div className="mt-4 rounded-lg border border-signal/25 bg-blue-50 p-4">
            <p className="text-sm leading-6 text-slate-700">
              A compound can score strongly for one outcome and weakly for another. Each score
              applies to a specific intervention, dose/form, population, outcome, comparator, and
              evidence base. A high score for one card should not be read as compound-wide approval.
            </p>
          </div>
        </section>

        <section className="mt-8" id="score-components">
          <SectionHeading eyebrow="Score Components" title="What each component means" />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {scoreComponents.map((component) => (
              <section
                className="rounded-lg border border-line bg-white p-4 shadow-panel"
                key={component.name}
              >
                <h3 className="text-base font-semibold text-ink">{component.name}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-700">{component.definition}</p>
                <dl className="mt-3 grid gap-2 text-sm">
                  <InlineDefinition label="Increases" value={component.increases} />
                  <InlineDefinition label="Lowers" value={component.lowers} />
                </dl>
              </section>
            ))}
          </div>
        </section>

        <section className="mt-8" id="composite-score">
          <SectionHeading eyebrow="Composite Score" title="Weighted, transparent heuristic" />
          <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-lg border border-line bg-white p-4 shadow-panel">
              <p className="text-sm leading-6 text-slate-700">
                The composite score is a transparent heuristic based on weighted components. The
                simple public explanation uses rounded weights so the intent is easy to understand.
                The current implementation weights are shown separately for traceability. Both are
                provisional review heuristics, not clinical recommendations.
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Regulatory risk can cap or override the final label for peptides, unapproved
                therapeutics, high-risk compounds, or products with major safety or legal concerns.
                Decimal scores are approximate and should not be read as mathematically precise
                medical advice.
              </p>
            </div>
            <div className="grid gap-4">
              <DataTable
                ariaLabel="Simple public composite score weighting"
                columns={["Simple public component", "Rounded weight"]}
                rows={compositeWeights}
              />
              <DataTable
                ariaLabel="Current implementation composite score weighting"
                columns={["Current implementation component", "Weight"]}
                rows={implementationWeights}
              />
            </div>
          </div>
        </section>

        <section className="mt-8" id="score-bands">
          <SectionHeading eyebrow="Score Bands" title="How to read the numeric score" />
          <DataTable ariaLabel="Score bands" columns={["Score", "Band"]} rows={scoreBands} />
        </section>

        <section className="mt-8" id="final-labels">
          <SectionHeading eyebrow="Final Label Legend" title="Labels carry the real decision context" />
          <DataTable
            ariaLabel="Final label legend"
            columns={["Label", "Meaning"]}
            rows={finalLabels}
          />
        </section>

        <section className="mt-8" id="evidence-hierarchy">
          <SectionHeading eyebrow="Evidence Hierarchy" title="Stronger evidence is more direct" />
          <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <ol className="grid list-decimal gap-2 pl-5">
              {evidenceHierarchy.map((level) => (
                <li
                  className="rounded-lg border border-line bg-white p-3 pl-4 text-sm text-slate-700 shadow-panel"
                  key={level}
                >
                  {level}
                </li>
              ))}
            </ol>
            <div className="rounded-lg border border-amberline/30 bg-amber-50 p-4">
              <h3 className="text-base font-semibold text-ink">Important warnings</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-amber-950">
                <li>Animal lifespan evidence is not human longevity evidence.</li>
                <li>Biomarker effects are not automatically clinical outcomes.</li>
                <li>Mechanistic plausibility is not proof of benefit.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-8" id="peptide-policy">
          <SectionHeading
            eyebrow="Peptide and Therapeutic Intervention Policy"
            title="Peptides are not treated as ordinary supplements"
          />
          <div className="mt-4 rounded-lg border border-amberline/30 bg-amber-50 p-4">
            <p className="text-sm leading-6 text-amber-950">
              Peptide cards emphasize regulatory status, approved indications, human evidence,
              safety signals, product-quality risk, and clinician oversight. Apex must not provide
              sourcing, compounding, reconstitution, injection, cycling, or self-administration
              instructions.
            </p>
          </div>
        </section>

        <section className="mt-8" id="review-status">
          <SectionHeading eyebrow="Review Status" title="Review labels describe evidence handling" />
          <DataTable
            ariaLabel="Review status legend"
            columns={["Status", "Meaning"]}
            rows={reviewStatuses}
          />
          <p className="mt-3 rounded-md border border-line bg-mist p-3 text-sm leading-6 text-slate-700">
            Human reviewed does not mean clinical guideline endorsed.
          </p>
        </section>

        <section className="mt-8" id="score-changes">
          <SectionHeading eyebrow="What Changes a Score?" title="Scores move when evidence changes" />
          <div className="mt-4 flex flex-wrap gap-2">
            {scoreChangeReasons.map((reason) => (
              <span
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                key={reason}
              >
                {reason}
              </span>
            ))}
          </div>
        </section>

        <section className="mt-8" id="examples">
          <SectionHeading eyebrow="Examples" title="Same compound, different claim" />
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {examples.map((example) => (
              <section
                className="rounded-lg border border-line bg-white p-4 shadow-panel"
                key={example.title}
              >
                <h3 className="text-base font-semibold text-ink">{example.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-700">{example.detail}</p>
              </section>
            ))}
          </div>
        </section>

        <section className="my-8" id="limitations">
          <SectionHeading eyebrow="Limitations" title="What the scores are not" />
          <div className="mt-4 rounded-lg border border-line bg-white p-4 shadow-panel">
            <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
              <li>Apex is educational.</li>
              <li>Scores are not personal medical advice.</li>
              <li>Scores do not replace clinician guidance.</li>
              <li>Scores are claim-specific, not compound-wide.</li>
              <li>Uncertainty should remain visible.</li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-semibold tracking-normal text-ink">{title}</h2>
    </div>
  );
}

function InlineDefinition({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-mist p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 leading-6 text-slate-700">{value}</dd>
    </div>
  );
}

function DataTable({
  ariaLabel,
  columns,
  rows
}: {
  ariaLabel: string;
  columns: readonly [string, string];
  rows: readonly (readonly [string, string])[];
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white shadow-panel">
      <table aria-label={ariaLabel} className="w-full border-collapse text-left text-sm">
        <thead className="bg-mist text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((column) => (
              <th className="px-3 py-2 font-semibold" key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th className="px-3 py-3 align-top font-semibold text-ink" scope="row">
                {label}
              </th>
              <td className={cn("px-3 py-3 align-top leading-6 text-slate-700")}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
