export function DashboardDataUnavailable() {
  return (
    <main className="min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
        <header className="rounded-lg border border-line bg-white p-4 shadow-panel">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-normal text-ink sm:text-3xl">
                  Apex Lifespan
                </h1>
                <span className="rounded-md border border-signal/25 bg-blue-50 px-2 py-1 text-xs font-semibold text-signal">
                  Evidence Intelligence
                </span>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                General public evidence dashboard. Draft evidence must stay citation-linked,
                uncertainty-aware, and separate from individualized medical advice.
              </p>
            </div>
            <nav aria-label="Legal links" className="flex flex-wrap gap-2 text-xs font-medium">
              <a
                href="/privacy"
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:border-signal hover:text-signal"
              >
                Privacy
              </a>
              <a
                href="/terms"
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:border-signal hover:text-signal"
              >
                Terms
              </a>
            </nav>
          </div>
        </header>

        <section className="rounded-lg border border-amberline/25 bg-amber-50 p-4 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-normal text-amberline">
            Database-backed evidence unavailable
          </p>
          <h2 className="mt-2 text-lg font-semibold text-ink">
            Evidence data temporarily unavailable
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
            The public dashboard is online, but reviewed evidence data could not be loaded from the
            configured production database. No seed fallback is shown while database mode is required.
          </p>
        </section>
      </div>
    </main>
  );
}
