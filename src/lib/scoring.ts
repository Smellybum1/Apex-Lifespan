import type { Claim, EvidenceLabel, SafetyAlert, ScoreSet } from "@/lib/types";

export function compositeScore(scores: ScoreSet) {
  const weighted =
    scores.evidenceDirectness * 0.22 +
    scores.evidenceRigor * 0.22 +
    scores.effectSize * 0.18 +
    scores.safety * 0.14 +
    (10 - scores.regulatoryRisk) * 0.1 +
    (10 - scores.hypePenalty) * 0.08 +
    scores.measurability * 0.06;

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
    { label: "Measurable", value: claim.scores.measurability },
    { label: "Hype control", value: 10 - claim.scores.hypePenalty }
  ];
}

export function scoreBand(score: number) {
  if (score >= 8) {
    return "Strong";
  }

  if (score >= 6) {
    return "Moderate";
  }

  if (score >= 4) {
    return "Limited";
  }

  return "Weak";
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
  /\b(?:not|isn['’]?t|not\s+yet|never|no)\s+(?:TGA|ARTG)\s+(?:approved|registered|listed|endorsed|certified)\b/i;
const researchUsePeptidePattern =
  /\b(research\s+use\s+only|not\s+for\s+human\s+consumption|reconstitute|reconstitution|injectable|injection|vial|lyophili[sz]ed|sterile\s+water|bac\s+water|bacteriostatic)\b/i;
const unicodeTgaApprovalNegationPattern =
  /\b(?:not|isn(?:'|\u2019)?t|not\s+yet|never|no)\s+(?:TGA|ARTG)\s+(?:approved|registered|listed|endorsed|certified)\b/i;

const tgaAustNumbersUrl =
  "https://www.tga.gov.au/products/medicines/labelling-and-advertising/medicines-and-biologicals-labelling-and-packaging/aust-numbers-medicine-labels";
const tgaPeptideSafetyUrl =
  "https://www.tga.gov.au/safety/safety-monitoring-and-information/safety-alerts/tga-warning-risks-importing-unapproved-peptide-products";
const nihOdsVitaminDUrl =
  "https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/";
const heuristicSourceLabel = "Heuristic check";

function isTgaApprovalNegation(text: string) {
  return (
    tgaApprovalNegationPattern.test(text) ||
    unicodeTgaApprovalNegationPattern.test(text)
  );
}

export function analyzeLabel(labelText: string): LabelFinding[] {
  const text = labelText.trim();

  if (!text) {
    return [];
  }

  const findings: LabelFinding[] = [];

  const mentionsProprietaryBlend = /proprietary blend/i.test(text);
  const negatesProprietaryBlend = /\b(no|not|without)\s+(?:a\s+)?proprietary blends?\b/i.test(text);

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

  if (
    tgaApprovalOverclaimPattern.test(text) &&
    !isTgaApprovalNegation(text)
  ) {
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

  if (/\b(vitamin\s*d|cholecalciferol)\b/i.test(text) && /\b(10000|10,000|20000|20,000)\s*(iu|i\.u\.)\b/i.test(text)) {
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
