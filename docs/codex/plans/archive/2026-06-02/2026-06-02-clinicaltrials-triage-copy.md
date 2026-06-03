# ClinicalTrials Triage Copy

- Goal: Make ClinicalTrials.gov live preview `/100` badges read as triage scores, consistent with PubMed.
- Constraints: Keep registry records separate from curated Trial Watcher records and do not imply live results are reviewed evidence.
- Done condition: ClinicalTrials.gov preview cards label their score as `Triage n/100`, and project memory records the live-source score wording rule.
- Files likely touched: `src/components/evidence-dashboard.tsx`, `docs/codex/project.md`.
- Steps:
  - Update the ClinicalTrials.gov score badge copy.
  - Update project memory for live-source score labels.
  - Run lint and a browser check by loading a trial suggestion.
- Risks: Keep copy compact so dense source cards remain scannable.
