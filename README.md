# Apex Lifespan

Apex Lifespan is an evidence intelligence dashboard for supplements, peptides, and healthspan interventions. It scores intervention-claim pairs rather than whole compounds, keeps uncertainty visible, and separates supplements from therapeutic or regulatory-risk interventions.

## Stack

- Next.js
- TypeScript
- Tailwind CSS
- TanStack Table
- Recharts
- PostgreSQL
- Prisma

## Commands

- Install: `npm install`
- Dev: `npm run dev`
- Stop dev server on port 3000: `npm run dev:stop`
- Test: `npm run test`
- Lint/typecheck/build: `npm run lint`, `npm run typecheck`, `npm run build`
- Database: `npm run db:validate`, `npm run db:generate`, `npm run db:migrate`, `npm run db:migrate:deploy`, `npm run db:push`, `npm run db:seed`
- Local source-candidate CLI: `npm run ingest:sources`

## Local Setup

Copy `.env.example` to `.env`, start PostgreSQL with `docker compose up -d postgres`, then run `npm run db:migrate` and `npm run db:seed`.

The dashboard route reads from Prisma when PostgreSQL is reachable and falls back to seed data when unavailable or empty. Set `APEX_DATA_SOURCE=seed` to force seed mode or `APEX_DATA_SOURCE=database` to fail instead of falling back.

Detailed local database, Windows DLL-lock, reset, and ingestion workflows live in `docs/codex/reference/local-operations.md`.

## Public MVP Demo Launch

Selected public MVP data mode: `APEX_DATA_SOURCE=seed`. The first public demo is seed-backed and read-only, with user-triggered PubMed and ClinicalTrials.gov preview routes enabled. Do not configure `DATABASE_URL` for the public MVP unless the deployment is deliberately switched to managed PostgreSQL.

Selected deployment path now that GitHub push access is restored: push the reviewed branch to GitHub, merge or select the intended production branch, then import the GitHub repo into Vercel. Manual Vercel CLI deployment from the local checkout remains a fallback. See Vercel's [deploy](https://vercel.com/docs/cli/deploy), [environment variable](https://vercel.com/docs/environment-variables), and [rollback](https://vercel.com/docs/cli/rollback) docs for the operator workflow.

Public MVP environment:

```bash
APEX_DATA_SOURCE=seed
NCBI_TOOL=apex-lifespan
NCBI_EMAIL=
```

Do not configure `APEX_CODEX_THREAD_ID`, `APEX_CODEX_REVIEW_TOKEN`, or other Codex sidecar variables in the public deployment. Those are local-only operator controls.

Build command: `npm run build`.

Local production smoke before deploy: set `APEX_DATA_SOURCE=seed`, then run:

```bash
npm run start
```

Vercel serves the deployed app runtime after GitHub import/deploy; no custom public start command is required for the selected Vercel path.

Predeploy validation from this checkout:

```bash
npm run test
npm run lint
npm run dev:stop
npm run typecheck
npm run build
npm audit
```

Production smoke target once deployed:

```bash
npm run smoke:public-mvp -- https://your-public-demo-url.example
```

The smoke command verifies the homepage, PubMed and ClinicalTrials.gov live-preview routes, invalid live-source term guards, no-store/noindex response headers, and the AU/TGA, citation, unreviewed-draft, and live-preview caveats.

Rollback path: use `vercel rollback <deployment-url>` or the Vercel dashboard to restore the previous production deployment, then smoke the dashboard and both live-source routes again.

Known MVP limitations: source-candidate review and promotion stay local; accepted `PMID 42141930` remains curation backlog until a human-owned claim-link and structured extraction are completed; live preview results are unreviewed research leads, not public evidence cards.

Launch handoff draft: `docs/codex/public-mvp-launch-handoff.md`.

## Local Ingestion

Source-candidate ingestion is an operator-only local workflow. It writes to the configured PostgreSQL database and is not exposed through public app routes.

Use the built-in help for the current flag list:

```bash
npm run ingest:sources -- --help
```

Before reviewing or queueing candidates, check local PostgreSQL connectivity:

```bash
npm run ingest:sources -- --db-status
```

For queueing, review, curation, and safety rules, see `docs/codex/source-candidate-workflow.md`. For the full command catalog, see `docs/codex/reference/source-candidate-command-reference.md`.

## Australia Regulatory Lens

Apex Lifespan tracks Australia/TGA regulatory status separately from evidence scores. Generic intervention evidence does not imply a product is legal to supply in Australia. Product-level confidence should come from an ARTG/AUST number.

## Safety Boundaries

- General public resource only.
- Public read-only MVP; admin review can come later.
- Australia/TGA is the first regulatory lens.
- No individualized medical advice.
- No sourcing, compounding, reconstitution, injection, cycling, or self-administration guidance for unapproved drugs or peptides.
- Every evidence card must stay traceable to citations and human review status.
