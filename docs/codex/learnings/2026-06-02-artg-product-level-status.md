---
tags: [australia, tga, regulatory, products]
scope: project
trigger: Adding Australia/TGA regulatory status to the evidence dashboard
evidence: TGA guidance says ARTG/AUST numbers identify product-level inclusion as AUST L, AUST L(A), or AUST R; generic intervention evidence is not the same as verified ARTG product status.
validation: Added structured `AustraliaRegulatoryStatus` records, seed examples with Unknown/Unapproved states, dashboard chips, and regulatory helper tests.
accepted_into: docs/codex/project.md
---

# Learning

- Problem: It is easy to imply a generic supplement intervention is authorised in Australia when only product-level ARTG/AUST evidence can prove that.
- Rule for next time: Keep intervention evidence and product-level Australia regulatory status separate until an ARTG/AUST number or official TGA source is captured.
- Example: Creatine can have a strong strength claim while its seed product card still says `AU: Unknown - AUST number not verified`.
- Rejected alternatives: Treating supplement categories as implicitly ARTG-listed or using third-party certifications as Australian regulatory proof.
