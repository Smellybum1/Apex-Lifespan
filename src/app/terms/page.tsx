import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms | Apex Lifespan",
  description: "Terms of use for the Apex Lifespan public evidence dashboard."
};

export default function TermsPage() {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-3xl rounded-lg border border-line bg-white p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Last updated June 11, 2026
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal text-ink">Terms</h1>
        <p className="mt-4 text-sm leading-6 text-slate-700">
          Apex Lifespan provides general evidence intelligence for healthspan-related
          interventions. By using the public dashboard, you agree to treat it as an educational
          research aid and not as individualized medical, legal, regulatory, or product-supply
          advice.
        </p>

        <section className="mt-6 grid gap-3">
          <LegalBlock
            title="No Medical Advice"
            body="The dashboard does not diagnose, treat, prevent, or cure disease and does not replace a qualified clinician. Do not use it for emergency decisions, medication changes, supplement dosing, or individualized care."
          />
          <LegalBlock
            title="Evidence Is Provisional"
            body="Scores, labels, source packets, and live search previews are review aids. Unreviewed AI drafts and live source leads can be incomplete, stale, or wrong until a human reviewer verifies the evidence and citations."
          />
          <LegalBlock
            title="Australia/TGA Context"
            body="Australian regulatory status is product-specific. Ingredient or intervention evidence must not be treated as proof that a product is listed, registered, exempt, excluded, or otherwise supplied lawfully in Australia."
          />
          <LegalBlock
            title="Restricted Use"
            body="Do not use the service to seek peptide sourcing, compounding, reconstitution, injection, cycling, dosing, or self-administration instructions. Regulatory and clinician-review warnings should remain intact."
          />
          <LegalBlock
            title="Public Read-Only Surface"
            body="Public routes are intended for read-only evidence display and source search previews. Review, promotion, and curation writes require authenticated operator workflows and audit records."
          />
          <LegalBlock
            title="No Warranty"
            body="The dashboard is provided as-is for research and review support. Availability, freshness, completeness, source access, and scoring are not guaranteed."
          />
        </section>
      </article>
    </main>
  );
}

function LegalBlock({ body, title }: { body: string; title: string }) {
  return (
    <section className="rounded-md border border-line bg-mist p-4">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-700">{body}</p>
    </section>
  );
}
