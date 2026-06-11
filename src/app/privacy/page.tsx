import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy | Apex Lifespan",
  description: "Privacy notes for the Apex Lifespan public evidence dashboard."
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-3xl rounded-lg border border-line bg-white p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Last updated June 11, 2026
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal text-ink">Privacy</h1>
        <p className="mt-4 text-sm leading-6 text-slate-700">
          Apex Lifespan is a public evidence dashboard. It is not a medical record system,
          patient portal, or personalized health service. Do not submit private health
          information, medical history, account credentials, or confidential product data into
          dashboard inputs.
        </p>

        <section className="mt-6 grid gap-3">
          <LegalBlock
            title="Public Dashboard Data"
            body="The public dashboard is designed to display general evidence summaries, citations, source-packet status, safety notes, and Australia/TGA context. Public routes are read-only and do not require a public account."
          />
          <LegalBlock
            title="Live Source Searches"
            body="When live PubMed or ClinicalTrials.gov previews are used, the search term is sent to the relevant public source API to retrieve unreviewed research leads. These previews are for review triage, not medical decision-making."
          />
          <LegalBlock
            title="Browser Storage"
            body="The optional Ask Codex panel can store a local sidecar URL and operator token in the browser on the device that entered them. This is intended for local operator review only; public deployments should not publish shared operator tokens."
          />
          <LegalBlock
            title="Hosting Logs"
            body="The hosting provider may process standard operational logs such as request time, route, status code, user agent, and IP-derived network information for security, debugging, abuse prevention, and reliability."
          />
          <LegalBlock
            title="Operator Workflows"
            body="Source-candidate review, promotion, and curation are human-owned workflows. They should run only behind authenticated operator access and audit logging, and public routes should remain read-only."
          />
          <LegalBlock
            title="Contact"
            body="For privacy, citation, or safety concerns, use the repository or operator contact channel published with the deployed project. Include the public URL, the evidence card or source involved, and the correction requested."
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
