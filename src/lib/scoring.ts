import type { Claim, EvidenceLabel, SafetyAlert, ScoreSet } from "@/lib/types";

export const SCORE_COMPONENT_GUIDE = [
  {
    definition: "How closely the evidence matches the exact claim being scored.",
    increases: "Same intervention, dose/form, population, outcome, comparator, and timeframe.",
    lowers:
      "Indirect endpoints, different forms, animal-only evidence, broad extrapolation, or a mismatched population.",
    name: "Directness"
  },
  {
    definition: "The strength and reliability of the study design and extraction quality.",
    increases:
      "Large randomized trials, consistent systematic reviews, clear comparators, and low bias concerns.",
    lowers:
      "Small uncontrolled studies, weak comparators, unclear methods, selective reporting, or poor extraction detail.",
    name: "Rigor"
  },
  {
    definition: "The practical size and importance of the observed or plausible effect.",
    increases: "Clinically meaningful outcomes, replicated effects, and endpoints users can understand.",
    lowers:
      "Tiny effects, surrogate-only changes, unclear clinical meaning, or outcomes far from the claim.",
    name: "Impact"
  },
  {
    definition: "Captured adverse-event, interaction, population-risk, and safety-signal context.",
    increases:
      "Benign safety profile in the relevant population, clear tolerability data, and low interaction concern.",
    lowers:
      "Known adverse-event signals, drug interactions, high-risk populations, uncertainty, or narrow safety margins.",
    name: "Safety"
  },
  {
    definition: "Whether the claim can be checked with clear endpoints, biomarkers, or trial outcomes.",
    increases: "Objective biomarkers, functional measures, registry outcomes, or validated clinical endpoints.",
    lowers: "Vague wellness wording, subjective claims without measures, or hard-to-observe promises.",
    name: "Measurability"
  },
  {
    definition: "How much the claim avoids promotional overreach or unsupported lifespan extrapolation.",
    increases:
      "Scoped wording, clear caveats, and separation between evidence-backed claims and speculation.",
    lowers: "Anti-aging hype, cure-all language, influencer claims, or claims broader than the cited evidence.",
    name: "Low hype risk"
  },
  {
    definition:
      "How little product, supply, legal, and regulator-context concern is attached to the claim or intervention.",
    increases:
      "Clear product-level regulatory evidence, low supply concern, and no captured warning signals.",
    lowers:
      "Unapproved therapeutic status, peptide/watchlist context, major safety warnings, or unresolved product status.",
    name: "Low regulatory risk"
  },
  {
    definition: "Product-level quality and authorization context captured separately from intervention evidence.",
    increases:
      "Exact product label, verified AUST/ARTG or absence evidence, sponsor, third-party quality signals, and source URL.",
    lowers:
      "Unknown product status, missing AUST/ARTG evidence, proprietary blends, unverifiable labels, or supply-context uncertainty.",
    name: "Product caveat context"
  }
] as const;

export const COMPOSITE_SCORE_WEIGHTS = [
  {
    displayWeight: "22%",
    key: "evidenceDirectness",
    label: "Directness",
    weight: 0.22
  },
  {
    displayWeight: "22%",
    key: "evidenceRigor",
    label: "Rigor",
    weight: 0.22
  },
  {
    displayWeight: "18%",
    key: "effectSize",
    label: "Impact",
    weight: 0.18
  },
  {
    displayWeight: "14%",
    key: "safety",
    label: "Safety",
    weight: 0.14
  },
  {
    displayWeight: "10%",
    invert: true,
    key: "regulatoryRisk",
    label: "Low regulatory risk",
    weight: 0.1
  },
  {
    displayWeight: "8%",
    invert: true,
    key: "hypePenalty",
    label: "Low hype risk",
    weight: 0.08
  },
  {
    displayWeight: "6%",
    key: "measurability",
    label: "Measurability",
    weight: 0.06
  }
] as const satisfies ReadonlyArray<{
  displayWeight: string;
  invert?: boolean;
  key: keyof ScoreSet;
  label: string;
  weight: number;
}>;

export const SCORE_BAND_LEGEND: Array<{
  band: ReturnType<typeof scoreBand>;
  range: string;
}> = [
  { band: "Strong", range: "8.0-10" },
  { band: "Moderate", range: "6.0-7.9" },
  { band: "Limited", range: "4.0-5.9" },
  { band: "Weak", range: "0-3.9" }
];

export const FINAL_LABEL_LEGEND: Array<{
  label: EvidenceLabel;
  meaning: string;
}> = [
  {
    label: "Core Evidence-Based",
    meaning:
      "Strong, direct evidence for the scoped claim, with safety and regulatory caveats still visible."
  },
  {
    label: "Conditional / Biomarker-Gated",
    meaning:
      "Best interpreted when baseline status, labs, risk group, or product form matches the evidence."
  },
  {
    label: "Useful for Specific Use Case",
    meaning: "Evidence is useful for a narrow endpoint or context, but should not be generalized."
  },
  {
    label: "Reasonable N-of-1 Experiment",
    meaning:
      "May be reasonable to track personally in low-risk contexts, but remains uncertain and not medical advice."
  },
  {
    label: "Speculative Watchlist",
    meaning: "Interesting but early, indirect, mechanistic, or incomplete evidence."
  },
  {
    label: "Safety Concern",
    meaning: "Safety signals materially affect interpretation and may outweigh potential benefit."
  },
  {
    label: "Avoid / Not Recommended",
    meaning:
      "Captured safety, regulatory, mismatch, or evidence concerns argue against presenting the claim as useful."
  },
  {
    label: "Requires Clinician Oversight",
    meaning:
      "The claim or intervention belongs in clinician-reviewed context rather than ordinary consumer self-use."
  },
  {
    label: "Regulatory Concern",
    meaning:
      "Regulatory or product-status concerns are central to the card and can override evidence enthusiasm."
  },
  {
    label: "Insufficient Evidence",
    meaning: "Current evidence does not support the claim well enough for a positive label."
  }
];

export function compositeScore(scores: ScoreSet) {
  const weighted = COMPOSITE_SCORE_WEIGHTS.reduce((total, component) => {
    const value =
      "invert" in component && component.invert
        ? 10 - scores[component.key]
        : scores[component.key];

    return total + value * component.weight;
  }, 0);

  return Math.round(weighted * 10) / 10;
}

export function labelTone(label: EvidenceLabel) {
  if (label === "Core Evidence-Based") {
    return "border-spruce/35 bg-teal-50 text-spruce";
  }

  if (label === "Safety Concern" || label === "Avoid / Not Recommended") {
    return "border-danger/35 bg-red-50 text-danger";
  }

  if (
    label === "Regulatory Concern" ||
    label === "Requires Clinician Oversight" ||
    label === "Speculative Watchlist"
  ) {
    return "border-amberline/35 bg-amber-50 text-amberline";
  }

  if (label === "Insufficient Evidence") {
    return "border-slate-300 bg-slate-50 text-slate-700";
  }

  return "border-signal/30 bg-blue-50 text-signal";
}

export function severityTone(severity: SafetyAlert["severity"]) {
  if (severity === "High" || severity === "Avoid") {
    return "bg-red-50 text-danger border-danger/30";
  }

  if (severity === "Clinician review recommended" || severity === "Moderate") {
    return "bg-amber-50 text-amberline border-amberline/30";
  }

  return "bg-teal-50 text-spruce border-spruce/30";
}

export function getClaimScoreRows(claim: Claim) {
  return [
    { label: "Directness", value: claim.scores.evidenceDirectness },
    { label: "Rigor", value: claim.scores.evidenceRigor },
    { label: "Impact", value: claim.scores.effectSize },
    { label: "Safety", value: claim.scores.safety },
    { label: "Measurability", value: claim.scores.measurability },
    { label: "Low regulatory risk", value: 10 - claim.scores.regulatoryRisk },
    { label: "Low hype risk", value: 10 - claim.scores.hypePenalty }
  ];
}

export function scoreBand(score: number) {
  return score >= 8 ? "Strong" : score >= 6 ? "Moderate" : score >= 4 ? "Limited" : "Weak";
}

export interface LabelFinding {
  id: string;
  level: "low" | "moderate" | "high";
  title: string;
  detail: string;
  sourceLabel?: string;
  sourceUrl?: string;
}

const peptidePattern =
  /\b(bpc[-\s]?157|tb[-\s]?500|thymosin|cjc[-\s]?1295|ipamorelin|tesamorelin|semaglutide|mots[-\s]?c|epitalon|aod[-\s]?9604)\b/i;
const austNumberPattern = /\bAUST\s+(?:L(?:\(A\))?|R)\s*\d{3,}\b/i;
const therapeuticClaimPattern =
  /\b(treats?|cures?|heals?|repairs?|prevents?|reverses?|regenerates?|therapeutic|medicine|clinical grade|prescription strength)\b/i;
const missingAustPattern =
  /\b(no\s+AUST|without\s+(?:an?\s+)?AUST|AUST\s+(?:number\s+)?pending|AUST\s+(?:number\s+)?not\s+(?:required|available|shown|listed|verified))\b/i;
const tgaApprovalOverclaimPattern =
  /\b(?:TGA|ARTG)\s+(?:approved|registered|listed|endorsed|certified)\b/i;
const tgaApprovalNegationPattern =
  /\b(?:not|isn(?:'|\u2019)?t|not\s+yet|never|no)\s+(?:TGA|ARTG)\s+(?:approved|registered|listed|endorsed|certified)\b/i;
const researchUsePeptidePattern =
  /\b(research\s+use\s+only|not\s+for\s+human\s+consumption|reconstitute|reconstitution|injectable|injection|vial|lyophili[sz]ed|sterile\s+water|bac\s+water|bacteriostatic)\b/i;

const tgaAustNumbersUrl =
  "https://www.tga.gov.au/how-we-regulate/labelling-and-packaging/medicines-and-biologicals/aust-numbers-medicine-labels";
const tgaPeptideSafetyUrl =
  "https://www.tga.gov.au/safety/safety-monitoring-and-information/safety-alerts/tga-warning-risks-importing-unapproved-peptide-products";
const nihOdsVitaminDUrl =
  "https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/";
const heuristicSourceLabel = "Heuristic check";

function isTgaApprovalNegation(text: string) {
  return tgaApprovalNegationPattern.test(text);
}

export function analyzeLabel(labelText: string): LabelFinding[] {
  const text = labelText.trim();

  if (!text) {
    return [];
  }

  const findings: LabelFinding[] = [];

  const mentionsProprietaryBlend = /proprietary blend/i.test(text);
  const negatesProprietaryBlend =
    /\b(no|not|without)\s+(?:a\s+)?proprietary blends?\b/i.test(text);

  if (mentionsProprietaryBlend && !negatesProprietaryBlend) {
    findings.push({
      id: "proprietary-blend",
      level: "moderate",
      title: "Proprietary blend",
      detail: "Dose transparency is limited, so ingredient-level evidence matching is weaker.",
      sourceLabel: heuristicSourceLabel
    });
  }

  if (peptidePattern.test(text)) {
    findings.push({
      id: "peptide-guardrail",
      level: "high",
      title: "Therapeutic peptide detected",
      detail:
        "AU/TGA caution: peptide products promoted online may be unapproved therapeutic goods. Route, sourcing, reconstitution, cycling, and self-administration guidance are out of scope; regulatory and clinician-review checks are required.",
      sourceLabel: "TGA peptide warning",
      sourceUrl: tgaPeptideSafetyUrl
    });
  }

  if (peptidePattern.test(text) && researchUsePeptidePattern.test(text)) {
    findings.push({
      id: "research-use-or-injectable-peptide",
      level: "high",
      title: "Research-use or injectable peptide language",
      detail:
        "Labels mentioning research use, vials, injections, or reconstitution near peptides are major AU/TGA red flags. Treat as a regulatory/safety review item, not consumer self-use guidance.",
      sourceLabel: "TGA peptide warning",
      sourceUrl: tgaPeptideSafetyUrl
    });
  }

  if (tgaApprovalOverclaimPattern.test(text) && !isTgaApprovalNegation(text)) {
    findings.push({
      id: "tga-approval-overclaim",
      level: "high",
      title: "Possible TGA approval overclaim",
      detail:
        "Australian status is product-specific. Do not treat broad phrases like TGA approved as proof of efficacy or supply status without checking the exact AUST number and ARTG record.",
      sourceLabel: "TGA AUST numbers",
      sourceUrl: tgaAustNumbersUrl
    });
  }

  if (missingAustPattern.test(text)) {
    findings.push({
      id: "aust-number-unresolved",
      level: "moderate",
      title: "AUST number unresolved",
      detail:
        "A missing, pending, or unverified AUST number means Australian supply status is unresolved. Verify the product-level ARTG/AUST record before treating label claims as Australia-ready.",
      sourceLabel: "TGA AUST numbers",
      sourceUrl: tgaAustNumbersUrl
    });
  } else if (therapeuticClaimPattern.test(text) && !austNumberPattern.test(text)) {
    findings.push({
      id: "aust-number-not-visible",
      level: "moderate",
      title: "No AUST number visible",
      detail:
        "Therapeutic-style claims should be checked against product-level ARTG/AUST status. An intervention evidence score or quality certification is not Australian market authorisation.",
      sourceLabel: "TGA AUST numbers",
      sourceUrl: tgaAustNumbersUrl
    });
  }

  if (
    /\b(vitamin\s*d|cholecalciferol)\b/i.test(text) &&
    /\b(10000|10,000|20000|20,000)\s*(iu|i\.u\.)\b/i.test(text)
  ) {
    findings.push({
      id: "high-vitamin-d",
      level: "moderate",
      title: "High vitamin D amount",
      detail:
        "High-dose vitamin D should be interpreted against deficiency status, total intake, and safety limits.",
      sourceLabel: "NIH ODS vitamin D",
      sourceUrl: nihOdsVitaminDUrl
    });
  }

  if (/\b(no side effects|reverses aging|detox|cures|repairs dna|extends lifespan)\b/i.test(text)) {
    findings.push({
      id: "hype-language",
      level: "high",
      title: "Hype language",
      detail: "Marketing claims should be matched against human clinical evidence and citations.",
      sourceLabel: heuristicSourceLabel
    });
  }

  if (/\b(nsf certified for sport|informed sport|usp verified|hasta)\b/i.test(text)) {
    findings.push({
      id: "certification",
      level: "low",
      title: "Quality signal",
      detail: "A recognized certification can improve product-quality confidence when verified.",
      sourceLabel: heuristicSourceLabel
    });
  }

  return findings;
}
