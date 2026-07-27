# Trust Polish Backlog Archive

Completed on 2026-06-13. Archived from the active roadmap after implementation to keep roadmap startup context small.

## Completed Items

1. [x] Sync "what this does not prove" bullets across all claim surfaces.
   Priority: P0.
   Acceptance: homepage active card, claim cards, source-packet details, intervention detail pages, and exported summaries render the same claim-specific boundaries; all seeded claims have meaningful bullets.
   Tests: render tests for creatine, vitamin D, omega-3, psyllium, and BPC-157 boundaries.

2. [x] Add component-score breakdowns to intervention detail claim cards.
   Priority: P0.
   Acceptance: every detail claim card shows Directness, Rigor, Impact, Safety, Measurability, Low regulatory risk, and Low hype risk with the same labels and directionality as the homepage.
   Tests: detail page render tests for score labels and methodology links/tooltips.

3. [x] Upgrade evidence-depth badge tooltips and accessibility.
   Priority: P0.
   Acceptance: "0 individual human trial rows extracted" explicitly says this does not mean no human trials exist; review/position-stand, systematic review, meta-analysis, RCT, observational, animal/mechanistic, clinical-trial-record, and regulatory warning categories stay distinct.
   Tests: source-packet tests plus keyboard/screen-reader render checks where practical.

4. [x] Improve Evidence Map semantics.
   Priority: P0.
   Acceptance: evidence map uses real table semantics or equivalent accessible structure; screen readers can identify intervention, outcome, score, band, final label, and review status; unassessed cells never imply absence of evidence.
   Tests: render tests for aria labels and legend wording.

5. [x] Make draft status visually dominant.
   Priority: P0.
   Acceptance: unreviewed cards say `AI Draft Classification: <label>`, `Pending human review`, and `Draft composite`; reviewed cards say `Human-reviewed classification` and `Reviewed composite`; human review tooltip remains visible and does not imply clinical guideline endorsement.
   Tests: render tests for reviewed and unreviewed cards.

6. [x] Make Product Label Analyzer demo status unmistakable.
   Priority: P0.
   Acceptance: demo profiles say "Demo only - not a verified product recommendation"; product quality score is visually separate from efficacy and AU/TGA/ARTG status; certification does not imply medical proof or Australian authorization.
   Tests: product analyzer render tests and copy safety tests.

7. [x] Add trust-critical regression tests.
   Priority: P0.
   Acceptance: tests fail if these ideas disappear: scores are review aids not medical advice; Apex scores claims not compounds; unassessed does not mean no evidence; human review is not guideline endorsement; peptides are not ordinary supplements; animal/biomarker/mechanistic evidence is not clinical proof; prohibited peptide instruction language is blocked in instructional contexts.
   Tests: focused content-safety tests plus public render tests.

8. [x] Add public feedback and issue intake loop.
   Priority: P1.
   Acceptance: users/operators have a lightweight feedback path, issues are triaged into a backlog, and owners/dates are visible.
   Tests: docs checks or route render tests if implemented in-app.
