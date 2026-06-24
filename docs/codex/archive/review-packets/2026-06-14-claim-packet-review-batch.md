# Claim Packet Review Batch - 2026-06-14

Purpose: prepare the 8 complete, unreviewed claim source packets for owner review in priority order.

Generated from:

- `npm run coverage:review -- --ready-claim-packets`
- Current local branch: `codex/queue-claim-sources`

This packet is decision support only. It does not provide individualized medical advice, qualified clinical review, product recommendation, product-level TGA/ARTG clearance, source-candidate acceptance, extraction writes, or public evidence promotion.

## How to Review

1. Start with the two high-attention packets: `bpc-157-injury-healing` and `vitamin-d-deficiency`.
2. For each claim, confirm the cited reference IDs, source links, structured extraction, claim scope, uncertainty label, safety/regulatory caveats, and public-facing caution wording.
3. If the packet is acceptable, use the authenticated operator console: `/operator`, then `Needs Human Review`.
4. If operator writes and browser-control approvals are enabled, use `Approve AI Review` for one packet or `Approve 8 AI Reviews` for the batch.
5. If anything looks wrong, leave the claim unreviewed and fix the packet or wording first.

The batch approval basis is `owner-approved-ai-review`. That means the owner accepts Codex's AI-assisted traceability/caveat review for this personal project. It is not a clinical guideline endorsement, qualified clinical review, product-level AU/TGA status decision, or medical advice.

## Batch Checklist

| Order | Claim ID | Intervention | Outcome | Label | Confidence | Priority | References | Status |
| --- | --- | --- | --- | --- | --- | ---: | ---: | --- |
| 1 | `bpc-157-injury-healing` | BPC-157 | Joint/tendon/skin | Regulatory Concern | Very low | 175 | 2/2 extracted | High attention |
| 2 | `vitamin-d-deficiency` | Vitamin D | Safety/adverse effects | Conditional / Biomarker-Gated | High | 175 | 1/1 extracted | High attention |
| 3 | `creatine-strength` | Creatine | Muscle/strength | Core Evidence-Based | High | 160 | 1/1 extracted | Owner approval eligible |
| 4 | `omega-3-cv-events` | Omega-3 | Cardiovascular events | Conditional / Biomarker-Gated | Moderate | 160 | 1/1 extracted | Owner approval eligible |
| 5 | `omega-3-triglycerides` | Omega-3 | LDL/ApoB/lipids | Useful for Specific Use Case | Moderate | 160 | 1/1 extracted | Owner approval eligible |
| 6 | `psyllium-ldl-lipids` | Psyllium | LDL/ApoB/lipids | Useful for Specific Use Case | Moderate | 160 | 1/1 extracted | Owner approval eligible |
| 7 | `creatine-lifespan` | Creatine | Mortality/lifespan | Insufficient Evidence | Very low | 150 | 1/1 extracted | Owner approval eligible |
| 8 | `vitamin-d-longevity` | Vitamin D | Mortality/lifespan | Insufficient Evidence | Low | 150 | 1/1 extracted | Owner approval eligible |

## Shared Confirmation Points

- The reference link fits the claim, not just the intervention name.
- The structured study row exists for each linked reference.
- The population, outcome, dose/form boundary, duration, adverse-event note, and applicability caveats remain visible.
- The final label and confidence label are conservative enough for the cited packet.
- No public wording implies individualized advice, product-level AU/TGA clearance, or certainty beyond the source packet.
- For insufficient-evidence claims, the packet should make the absence of seeded endpoint evidence clear rather than implying a negative proof.

## External AI Cross-Check Prompt Template

Use this only for a second AI critique, especially on high-attention packets. Review one claim at a time.

```text
Please cross-check this Apex Lifespan AI evidence review.

Claim ID: <claim-id>
Intervention: <intervention>
Outcome: <outcome>
Current label: <label>
Confidence: <confidence>
References and structured study summary are below.

Focus on citation fit, claim scope, uncertainty wording, safety/regulatory caveats, and whether the public wording should stay cautious.

Do not provide sourcing, compounding, reconstitution, injection, cycling, dosing, self-administration, diagnosis, or individualized medical advice.
```

## 1. `bpc-157-injury-healing`

- Intervention: BPC-157
- Outcome: Joint/tendon/skin
- Current label: Regulatory Concern
- Confidence: Very low
- Priority reasons: Unreviewed draft claim; complete source packet ready for human review; regulatory concern label.
- Claim boundary: human clinical evidence is limited in seed data. Dose/form and self-administration details are out of scope. Duration is not established for public guidance.
- Operator packet: `npm run coverage:review -- --claim bpc-157-injury-healing`
- Operator UI: `/operator?reviewClaim=bpc-157-injury-healing`

References:

| Reference ID | Source | Title | Year | URL |
| --- | --- | --- | ---: | --- |
| `tga-safety-alerts` | TGA | Safety alerts | 2026 | https://www.tga.gov.au/safety/safety-monitoring-and-information/safety-alerts |
| `fda-bpc-157-category-2` | FDA | Certain Bulk Drug Substances for Use in Compounding that May Present Significant Safety Risks | 2023 source context | https://www.fda.gov/drugs/compounding/safety-risks-associated-certain-bulk-drug-substances-nominated-use-compounding |

Structured extraction:

| Study ID | Source | Type | Outcomes | Safety/regulatory note |
| --- | --- | --- | --- | --- |
| `study-fda-bpc-157` | FDA | Regulatory safety warning | Regulatory concern; safety uncertainty | FDA notes potential significant safety risk context for the substance. |
| `study-tga-unapproved-peptides` | TGA | Regulatory safety warning | ARTG status; regulatory concern; public safety monitoring | TGA alerts highlight unknown safety, quality, effectiveness, product identity, and contamination risks for unapproved peptide products. |

Confirm before approval:

- Keep the regulatory-concern framing.
- Do not add peptide sourcing, compounding, reconstitution, injection, cycling, dosing, or self-administration guidance.
- Do not infer product-level ARTG/AUST status from these generic regulatory sources.
- If using ChatGPT Pro, ask only for a citation-fit and caveat critique.

## 2. `vitamin-d-deficiency`

- Intervention: Vitamin D
- Outcome: Safety/adverse effects
- Current label: Conditional / Biomarker-Gated
- Confidence: High
- Priority reasons: Unreviewed draft claim; complete source packet ready for human review; safety outcome; high confidence draft.
- Claim boundary: people with low vitamin D status or deficiency contexts. D2 or D3 context must be matched to labs and clinical context. Duration varies by deficiency and monitoring plan.
- Operator packet: `npm run coverage:review -- --claim vitamin-d-deficiency`
- Operator UI: `/operator?reviewClaim=vitamin-d-deficiency`

References:

| Reference ID | Source | Title | URL |
| --- | --- | --- | --- |
| `ods-vitamin-d` | NIH Office of Dietary Supplements | Vitamin D - Health Professional Fact Sheet | https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/ |

Structured extraction:

| Study ID | Source | Type | Outcomes | Safety note |
| --- | --- | --- | --- | --- |
| `study-vitamin-d-ods` | NIH Office of Dietary Supplements | Systematic review / narrative review source | Deficiency; safety limits; interactions | Safety issues are dose and context dependent. |

Confirm before approval:

- Keep the biomarker-gated framing.
- Confirm adverse-event and upper-limit wording does not imply product safety or TGA clearance.
- Do not convert lab/context-dependent evidence into general self-treatment advice.

## 3. `creatine-strength`

- Intervention: Creatine
- Outcome: Muscle/strength
- Current label: Core Evidence-Based
- Confidence: High
- Priority reasons: Unreviewed draft claim; complete source packet ready for human review; high confidence draft.
- Claim boundary: adults in exercise and sport nutrition literature. Creatine monohydrate context is cited, but dose details must be checked per study. Duration varies by trial and review.
- Operator packet: `npm run coverage:review -- --claim creatine-strength`
- Operator UI: `/operator?reviewClaim=creatine-strength`

References:

| Reference ID | Source | Identifier | Title | Year | URL |
| --- | --- | --- | --- | ---: | --- |
| `issn-creatine-2017` | PubMed | PMID: 28615996 | International Society of Sports Nutrition position stand: safety and efficacy of creatine supplementation in exercise, sport, and medicine | 2017 | https://pubmed.ncbi.nlm.nih.gov/28615996/ |

Structured extraction:

| Study ID | Source | Type | Outcomes | Safety note |
| --- | --- | --- | --- | --- |
| `study-creatine-issn` | Journal of the International Society of Sports Nutrition via PubMed | Systematic review / position stand | Strength; lean mass; exercise capacity; safety | Seed review cites safety considerations; patient-specific review still required. |

Confirm before approval:

- The strength claim is supported by the cited position stand and structured row.
- Public wording stays population-scoped and does not become individualized advice.
- Safety caveats remain separate from efficacy strength.

## 4. `omega-3-cv-events`

- Intervention: Omega-3
- Outcome: Cardiovascular events
- Current label: Conditional / Biomarker-Gated
- Confidence: Moderate
- Priority reasons: Unreviewed draft claim; complete source packet ready for human review; moderate confidence draft.
- Claim boundary: mixed cardiovascular-risk populations. EPA-only, EPA/DHA, prescription, and supplement forms must be separated. Some evidence streams use multi-year trials.
- Operator packet: `npm run coverage:review -- --claim omega-3-cv-events`
- Operator UI: `/operator?reviewClaim=omega-3-cv-events`

References:

| Reference ID | Source | Title | URL |
| --- | --- | --- | --- |
| `ods-omega-3` | NIH Office of Dietary Supplements | Omega-3 Fatty Acids - Health Professional Fact Sheet | https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional/ |

Structured extraction:

| Study ID | Source | Type | Outcomes | Safety note |
| --- | --- | --- | --- | --- |
| `study-omega-3-ods` | NIH Office of Dietary Supplements | Systematic review / narrative review source | Triglycerides; cardiovascular endpoints; atrial fibrillation safety signal | Higher-dose contexts require attention to atrial fibrillation signals, bleeding context, and medication interactions. |

Confirm before approval:

- Keep cardiovascular event claims conditional and form-specific.
- Do not blur prescription EPA evidence with generic supplement evidence.
- Keep atrial fibrillation, bleeding context, and medication-interaction cautions visible.

## 5. `omega-3-triglycerides`

- Intervention: Omega-3
- Outcome: LDL/ApoB/lipids
- Current label: Useful for Specific Use Case
- Confidence: Moderate
- Priority reasons: Unreviewed draft claim; complete source packet ready for human review; moderate confidence draft.
- Claim boundary: adults in omega-3 cardiovascular and lipid literature. EPA/DHA amount and product form need study-level matching. Duration varies by trial.
- Operator packet: `npm run coverage:review -- --claim omega-3-triglycerides`
- Operator UI: `/operator?reviewClaim=omega-3-triglycerides`

References:

| Reference ID | Source | Title | URL |
| --- | --- | --- | --- |
| `ods-omega-3` | NIH Office of Dietary Supplements | Omega-3 Fatty Acids - Health Professional Fact Sheet | https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional/ |

Structured extraction:

| Study ID | Source | Type | Outcomes | Safety note |
| --- | --- | --- | --- | --- |
| `study-omega-3-ods` | NIH Office of Dietary Supplements | Systematic review / narrative review source | Triglycerides; cardiovascular endpoints; atrial fibrillation safety signal | Higher-dose contexts require attention to atrial fibrillation signals, bleeding context, and medication interactions. |

Confirm before approval:

- Keep the lipid-use-case framing separate from cardiovascular event prevention.
- Make sure formulation and product-form uncertainty remains visible.
- Keep safety notes attached to higher-dose contexts.

## 6. `psyllium-ldl-lipids`

- Intervention: Psyllium
- Outcome: LDL/ApoB/lipids
- Current label: Useful for Specific Use Case
- Confidence: Moderate
- Priority reasons: Unreviewed draft claim; complete source packet ready for human review; moderate confidence draft.
- Claim boundary: adults in controlled soluble-fiber lipid trials, including psyllium arms. Product and amount need study-level matching. Duration varies across controlled dietary-fiber trials.
- Operator packet: `npm run coverage:review -- --claim psyllium-ldl-lipids`
- Operator UI: `/operator?reviewClaim=psyllium-ldl-lipids`

References:

| Reference ID | Source | Identifier | Title | Year | URL |
| --- | --- | --- | --- | ---: | --- |
| `brown-dietary-fiber-1999` | American Journal of Clinical Nutrition via PubMed | PMID: 9925120; DOI: 10.1093/ajcn/69.1.30 | Cholesterol-lowering effects of dietary fiber: a meta-analysis | 1999 | https://pubmed.ncbi.nlm.nih.gov/9925120/ |

Structured extraction:

| Study ID | Source | Type | Outcomes | Safety/tolerability note |
| --- | --- | --- | --- | --- |
| `study-brown-dietary-fiber-1999` | American Journal of Clinical Nutrition via PubMed | Meta-analysis | Total cholesterol; LDL cholesterol; triglycerides; HDL cholesterol | Adverse-event detail is not the focus of the seed extraction; product tolerability and medication timing still need review. |

Confirm before approval:

- Keep the effect framed as a specific lipid-use case, not a broad cardiovascular-outcome claim.
- Note that the abstract characterizes practical-range lipid effect as small.
- Keep tolerability and medication-timing review caveats visible.

## 7. `creatine-lifespan`

- Intervention: Creatine
- Outcome: Mortality/lifespan
- Current label: Insufficient Evidence
- Confidence: Very low
- Priority reasons: Unreviewed draft claim; complete source packet ready for human review.
- Claim boundary: no seeded human lifespan endpoint evidence. Dose/form and duration are not established for this claim.
- Operator packet: `npm run coverage:review -- --claim creatine-lifespan`
- Operator UI: `/operator?reviewClaim=creatine-lifespan`

References:

| Reference ID | Source | Identifier | Title | Year | URL |
| --- | --- | --- | --- | ---: | --- |
| `issn-creatine-2017` | PubMed | PMID: 28615996 | International Society of Sports Nutrition position stand: safety and efficacy of creatine supplementation in exercise, sport, and medicine | 2017 | https://pubmed.ncbi.nlm.nih.gov/28615996/ |

Structured extraction:

| Study ID | Source | Type | Outcomes | Safety note |
| --- | --- | --- | --- | --- |
| `study-creatine-issn` | Journal of the International Society of Sports Nutrition via PubMed | Systematic review / position stand | Strength; lean mass; exercise capacity; safety | Seed review cites safety considerations; patient-specific review still required. |

Confirm before approval:

- The source packet supports creatine context, but not a human lifespan endpoint claim.
- Keep `Insufficient Evidence` and `Very low` confidence unless new lifespan-endpoint evidence is added.
- Do not imply that strength or lean-mass evidence proves longevity benefit.

## 8. `vitamin-d-longevity`

- Intervention: Vitamin D
- Outcome: Mortality/lifespan
- Current label: Insufficient Evidence
- Confidence: Low
- Priority reasons: Unreviewed draft claim; complete source packet ready for human review.
- Claim boundary: already-sufficient adults are not established as a clear-benefit group in seed data. Duration varies. Dose/form is not established for this claim.
- Operator packet: `npm run coverage:review -- --claim vitamin-d-longevity`
- Operator UI: `/operator?reviewClaim=vitamin-d-longevity`

References:

| Reference ID | Source | Title | URL |
| --- | --- | --- | --- |
| `ods-vitamin-d` | NIH Office of Dietary Supplements | Vitamin D - Health Professional Fact Sheet | https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/ |

Structured extraction:

| Study ID | Source | Type | Outcomes | Safety note |
| --- | --- | --- | --- | --- |
| `study-vitamin-d-ods` | NIH Office of Dietary Supplements | Systematic review / narrative review source | Deficiency; safety limits; interactions | Safety issues are dose and context dependent. |

Confirm before approval:

- The source packet supports vitamin D deficiency/safety context, but not a general longevity benefit for already-sufficient adults.
- Keep `Insufficient Evidence` and cautious applicability wording.
- Do not convert deficiency correction evidence into a broad lifespan claim.

## After Approval

Run a read-only coverage check against the intended non-production database:

```powershell
npm run coverage:review -- --env-file .env.vercel.preview.local --summary
```

Expected direction after successful review: unreviewed claim count should fall, and the roadmap expansion blocker should move from claim-review blocked toward ready for the next 5-10 intervention onboarding batch. Public promotion and production deploy decisions remain separate.
