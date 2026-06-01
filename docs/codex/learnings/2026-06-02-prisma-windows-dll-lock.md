---
tags: [windows, prisma, validation]
scope: project
trigger: Running `npm run typecheck` while the dev server or build process was active
evidence: Prisma generate failed twice with `EPERM: operation not permitted, rename ... query_engine-windows.dll.node`.
validation: Stopping the dev server and rerunning `npm run typecheck` sequentially passed.
accepted_into: docs/codex/project.md
---

# Learning

- Problem: Prisma client generation can fail on Windows when another Node/Next process is holding the generated query-engine DLL.
- Rule for next time: Stop the dev server before Prisma-generating checks and avoid running `npm run typecheck` in parallel with `npm run build`.
- Example: `npm run typecheck` passed after stopping the process listening on port 3000.
- Rejected alternatives: Retrying in parallel or treating the EPERM as a schema/type error.
