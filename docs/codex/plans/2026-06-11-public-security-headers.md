# Public Security Headers Slice

Date: 2026-06-11

## Goal

Add low-risk production security headers as part of the roadmap hardening step without blocking Next.js scripts, dashboard hydration, live source previews, or future Auth.js redirects.

## Scope

- Configure global response headers in `next.config.mjs`.
- Cover MIME sniffing, referrer leakage, frame embedding, limited CSP directives, HTTPS downgrade protection, and unused device/browser APIs.
- Add a static config test so the intended baseline is hard to remove accidentally.

## Out Of Scope

- Strict script/style CSP.
- Per-request CSP nonces.
- COOP/COEP cross-origin isolation.
- Production external security scanner pass.

Those require browser QA against the deployed app and authenticated operator flows.

## Validation

- Header config test.
- Public read-only boundary tests.
- `npm run typecheck`
- `npm run build`
- `npm run lint`
- `npm audit`

