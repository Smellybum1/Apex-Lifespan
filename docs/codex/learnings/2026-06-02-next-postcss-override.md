---
tags: [dependencies, security, nextjs]
scope: project
trigger: npm audit after Next.js install
evidence: Next 15.5.18 installed nested postcss 8.4.31 and `npm audit` reported GHSA-qx2v-qp2m-jg93.
validation: Added a package override and aligned direct postcss to 8.5.15; `npm ls next postcss` showed Next deduped to postcss 8.5.15 and `npm audit` reported 0 vulnerabilities.
accepted_into: package.json
---

# Learning

- Problem: A clean Next.js install can still carry an older nested PostCSS through Next's dependency tree.
- Rule for next time: After changing Next or PostCSS, run `npm ls next postcss` and `npm audit`; keep the PostCSS override only while it is needed and still compatible.
- Example: `package.json` uses `"overrides": { "postcss": "^8.5.15" }` with direct `postcss` aligned to `^8.5.15`.
- Rejected alternatives: `npm audit fix --force` suggested downgrading Next to 9.3.3, which would be a breaking and inappropriate fix.
