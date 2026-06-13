# Evidence Product Roadmap Reference

Detailed reference material split out of the active roadmap to keep normal startup context small.

## Data Model Roadmap

Future schema work should prefer normalized, queryable records over page-specific strings:

- `interventions`: slug, name, synonyms, category, descriptions, common forms, safety/regulatory summaries, reviewed timestamps.
- `claims`: intervention, outcome, text, population, dose/form, duration, comparator, effect, safety/applicability notes, `does_not_prove`, review status.
- `claim_scores`: component scores, composite, band, score version, computed timestamp.
- `score_history`: old/new score and label, reason, changed by, source event.
- `studies`: source type taxonomy, citation IDs, abstract/full-text metadata, extraction fields, funding/conflicts, risk of bias.
- `source_packets`: claim/source linkage, extraction status, citation status, review status, reviewer notes.
- `claim_studies`: relevance, support/contradiction flags, notes.
- `trials`: NCT ID, status, phase, enrollment, dates, results posted, relevance classification, triage score.
- `safety_alerts`: intervention, source, region, date, severity, alert type, summary, URL.
- `regulatory_statuses`: intervention/product, region, status, source, last checked.
- `products`: label text, ingredients, serving size, proprietary blend, certifications, region, regulatory number, `is_demo_profile`, quality score.
- `review_events`: entity type/id, event type, reviewer, notes, timestamp.
- `changelog_entries`: public trust-relevant changes, category, related claim/intervention, source references.

## Evidence Ingestion Roadmap

Source targets to evaluate with terms/API review before production use:

- PubMed / NCBI E-utilities.
- PubMed Central open-access full text where available.
- ClinicalTrials.gov API.
- NIH Office of Dietary Supplements fact sheets.
- NIH Dietary Supplement Label Database.
- LiverTox, NCCIH, FDA, TGA.
- EMA, MHRA, Health Canada where relevant.
- WADA prohibited list for sport-risk flags.

Ingestion stages:

1. Query generation.
2. Source retrieval.
3. Deduplication.
4. Intervention synonym mapping.
5. Source-type classification.
6. Claim relevance triage.
7. Structured extraction.
8. Citation metadata capture.
9. Safety/regulatory extraction.
10. Draft evidence-card generation.
11. Human review queue.
12. Score recomputation.
13. Changelog event generation.

No ingestion stage may auto-promote public evidence or mark a claim human-reviewed.

## Intervention Expansion Candidates

Add slowly, after trust, scoring transparency, source taxonomy, review workflow, and evidence-depth displays are stable.

Suggested supplement batch:

- Magnesium.
- Protein / whey / essential amino acids.
- Taurine.
- NAC.
- Curcumin.
- Ashwagandha.
- Collagen peptides.
- Melatonin.
- Berberine.
- Urolithin A.
- CoQ10, lutein/zeaxanthin, glycine, TMG/betaine, astaxanthin, green tea/matcha as later candidates.

Peptide/therapeutic watchlist candidates must default conservative:

- TB-500 / thymosin beta-4, GHK-Cu, Epitalon, MOTS-c, CJC-1295, Ipamorelin, Tesamorelin, Semax, Selank, KPV, LL-37, AOD-9604.
- GLP-1 receptor agonists, metformin, rapamycin, acarbose, statins, SGLT2 inhibitors as therapeutics/drug watchlist items, not supplements.

Default labels for unapproved peptide/watchlist cards should remain `Speculative Watchlist`, `Regulatory Concern`, `Requires Clinician Oversight`, or `Insufficient Evidence` unless approved-use and strong human evidence apply to the scoped claim.

## Testing Roadmap

- Unit: score formula, score bands, label caps/overrides, review-status display, source-type classification, evidence-depth wording, trial relevance, product parsing.
- Integration: PubMed and ClinicalTrials.gov search endpoints, intervention detail hydration, source-packet import, score recomputation, safety alert ingestion.
- Content safety: trust-critical wording; peptide prohibited-instruction contexts; product-quality/regulatory/efficacy separation.
- Accessibility: keyboard navigation, tooltip focus behavior, evidence map semantics, contrast, screen-reader labels.
- Operations: public smoke, operator smoke, scheduled ingestion dry-run, readiness summaries, audit/dependency checks.

## Definition Of Done

A feature is done only when:

- It is claim-specific, not compound-wide.
- It displays uncertainty clearly.
- It has citation/source linkage where medical claims are made.
- It does not overstate animal, mechanistic, or biomarker evidence.
- It respects peptide and unapproved-therapeutic safety boundaries.
- It is accessible by keyboard and screen reader where practical.
- It has tests for trust-critical wording or logic.
- It appears in the changelog if it changes public interpretation.
- It does not expose private operator tokens or sensitive config.
- It keeps product quality separate from efficacy.
- It keeps regulatory status separate from evidence of benefit.
