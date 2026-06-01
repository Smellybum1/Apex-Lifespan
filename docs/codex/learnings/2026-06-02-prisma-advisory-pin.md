---
tags: [dependencies, security, prisma]
scope: project
trigger: Installing Prisma for PostgreSQL persistence
evidence: Installing Prisma 7.8.0 introduced moderate advisories through `@prisma/dev` and `@hono/node-server`; npm reported Prisma 6.19.3 as the compatible fix target.
validation: Pinned both `prisma` and `@prisma/client` to 6.19.3; `npm audit` reported 0 vulnerabilities, and `npm run db:validate`, `npm run db:generate`, `npm run typecheck`, and `npm run build` passed.
accepted_into: package.json
---

# Learning

- Problem: The latest Prisma major can introduce dev-tool dependency advisories even when the app code is not using the affected path.
- Rule for next time: Keep `prisma` and `@prisma/client` on the same pinned version, and check `npm audit` plus Prisma validation after version changes.
- Example: The project currently uses Prisma 6.19.3 for both packages.
- Rejected alternatives: Keeping Prisma 7.8.0 with known advisories, or forcing unrelated dependency changes without validating the generated client.
