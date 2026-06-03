# Keyboard Claim Table

## Goal

Make the claim score table selectable by keyboard as well as mouse.

## Constraints

- Keep the table layout and sorting behavior unchanged.
- Preserve the public read-only workflow.
- Avoid a larger component refactor.

## Done Condition

- Claim score rows are focusable.
- `Enter` and `Space` select the focused claim row.
- The active row exposes selection state to assistive technology.
- Browser smoke confirms keyboard selection changes the active evidence card.

## Files Likely Touched

- `src/components/evidence-dashboard.tsx`
- `docs/codex/project.md`

## Steps

1. Add row keyboard activation and selection semantics.
2. Update project memory.
3. Validate with lint/typecheck/build/tests.
4. Browser-smoke the keyboard flow.

## Validation

- `npm run lint`
- `npm run test`
- `npm run typecheck`
- `npm run build`
- HTTP and Playwright keyboard smoke

## Risks

- Focusable rows should not interfere with table header sort buttons.
- Space key should not scroll the page when it activates a row.

## Result

- Added focus, `aria-selected`, Enter activation, and Space activation to claim score table rows.
- Kept table sorting buttons unchanged.
- Browser smoke confirmed keyboard selection changes the active evidence card for Omega-3 with Enter and BPC-157 with Space.
- Validation passed: lint, full tests, typecheck, build, and local HTTP smoke.
