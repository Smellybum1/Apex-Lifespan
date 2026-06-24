import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Feedback & Issue Intake | Apex Lifespan",
  description: "How to report evidence, scoring, safety, regulatory, and UX issues for Apex Lifespan."
};

const issueTemplateUrl =
  "https://github.com/Smellybum1/Apex-Lifespan/issues/new?template=apex-feedback.yml";

const reportTypes = [
  "Broken citation link or source metadata issue",
  "Evidence packet is missing an important trial, review, safety alert, or regulatory source",
  "Score wording, label, or evidence-depth badge is confusing",
  "Unassessed cell could be mistaken for no evidence found",
  "Product Label Analyzer false positive, false negative, or demo-status issue",
  "Accessibility, mobile layout, or navigation issue"
] as const;

const triageStates = [
  ["New", "Received but not yet reviewed."],
  ["Needs source", "Needs a citation, regulator link, screenshot, or reproduction detail."],
  ["Accepted", "Added to the implementation backlog with an owner or next review step."],
  ["Not planned", "Closed with rationale, usually because it would weaken scope or safety boundaries."],
  ["Done", "Fixed, documented, or superseded by a shipped change."]
] as const;

export default function FeedbackPage() {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="inline-flex rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-signal hover:text-signal"
        >
          Back to dashboard
        </Link>

        <header className="mt-4 border-b border-line pb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Public feedback loop
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-ink">
            Feedback &amp; Issue Intake
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-700">
            Report evidence, citation, scoring, safety, regulatory, accessibility, or product-demo
            issues. Feedback is triaged into the public backlog; it does not create medical advice,
            source promotion, or operator write control.
          </p>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            Last updated: June 13, 2026. Next scheduled review: June 14, 2026 post-launch review.
          </p>
        </header>

        <section className="mt-6 rounded-lg border border-line bg-white p-4 shadow-panel">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink">Submit Feedback</h2>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Use the GitHub issue template when available. Include the page URL, claim or
                intervention name, citation links, screenshots, and what you expected to happen.
              </p>
            </div>
            <a
              href={issueTemplateUrl}
              className="inline-flex rounded-md border border-signal/25 bg-blue-50 px-3 py-2 text-sm font-semibold text-signal hover:border-signal"
            >
              Open GitHub Issue
            </a>
          </div>
          <p className="mt-3 rounded-md border border-amberline/30 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
            Do not include private health information, urgent medical questions, peptide sourcing,
            compounding, injection, cycling, dosing, or self-administration requests.
          </p>
        </section>

        <section className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-line bg-white p-4 shadow-panel">
            <h2 className="text-base font-semibold text-ink">Good Reports Include</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
              {reportTypes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-line bg-white p-4 shadow-panel">
            <h2 className="text-base font-semibold text-ink">Triage Ownership</h2>
            <dl className="mt-3 grid gap-2 text-sm">
              <div className="rounded-md border border-line bg-mist p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Owner
                </dt>
                <dd className="mt-1 text-slate-700">Project operator / evidence reviewer.</dd>
              </div>
              <div className="rounded-md border border-line bg-mist p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Review cadence
                </dt>
                <dd className="mt-1 text-slate-700">
                  Reviewed during the June 14, 2026 post-launch check and regular backlog triage.
                </dd>
              </div>
              <div className="rounded-md border border-line bg-mist p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Public evidence changes
                </dt>
                <dd className="mt-1 text-slate-700">
                  Require source review, citation traceability, and explicit human-owned promotion.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="mt-4 rounded-lg border border-line bg-white p-4 shadow-panel">
          <h2 className="text-base font-semibold text-ink">Issue States</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="border-b border-line bg-mist px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    State
                  </th>
                  <th className="border-b border-line bg-mist px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Meaning
                  </th>
                </tr>
              </thead>
              <tbody>
                {triageStates.map(([state, meaning]) => (
                  <tr key={state}>
                    <td className="border-b border-line px-3 py-3 font-semibold text-ink">
                      {state}
                    </td>
                    <td className="border-b border-line px-3 py-3 text-slate-700">{meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </article>
    </main>
  );
}
